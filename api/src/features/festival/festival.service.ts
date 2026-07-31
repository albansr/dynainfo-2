import type { IAnalyticsQueryBuilder, FilterCondition } from '../../core/db/clickhouse/query/interfaces.js';
import {
  FESTIVAL_METRICS,
  FESTIVAL_DEFAULT_GROUP_BY,
  FESTIVAL_DATE_FIELDS,
  brandGroupFilters,
  rappelGroupFilters,
  type FestivalBalance,
  type FestivalListRow,
  type FestivalDailyPoint,
} from './festival.schemas.js';

/** Coalesce a possibly-null/undefined query value to a number. */
function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Keep null (no comparison base) distinct from 0 for growth fields. */
function nullableNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Day index (UTC epoch days) of a yyyy-MM-dd string. */
function epochDay(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}

/** yyyy-MM-dd of `date` shifted by `days`. */
function shiftDay(date: string, days: number): string {
  return new Date((epochDay(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Position of "today" within the event window: fully closed days, the running
 * day number (1-based; 0 before the event, capped at the length) and the total
 * length. "Today" is resolved in America/Bogota — the API container runs in
 * UTC and would otherwise close each day five hours early.
 */
function closedEventDays(startDate: string, endDate: string): { closed: number; currentDay: number; total: number } {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const total = epochDay(endDate) - epochDay(startDate) + 1;
  const elapsed = epochDay(today) - epochDay(startDate);
  const closed = Math.min(Math.max(elapsed, 0), total);
  const currentDay = Math.min(Math.max(elapsed + 1, 0), total);
  return { closed, currentDay, total };
}

/**
 * Sources for the unique-reach counts (numérica / items): the same field
 * across both sales tables, deduped BETWEEN tables — a customer/product
 * present in facturado and comprometido counts once.
 */
function distinctSources(field: string): Array<{ table: string; field: string }> {
  return Object.keys(FESTIVAL_DATE_FIELDS).map((table) => ({ table, field }));
}

/**
 * Budget proration factor: the target grows day by day during the event
 * (día 3 de 5 → 3/5 of the budget) and is the full budget before the event
 * starts (the complete goal is the reference) and after it ends.
 */
function budgetProrateFactor(window?: { startDate: string; endDate: string }): number {
  if (!window) return 1;
  const { currentDay, total } = closedEventDays(window.startDate, window.endDate);
  return currentDay > 0 && total > 0 ? currentDay / total : 1;
}

/**
 * Service for the Festival Virtual dashboard.
 *
 * Reuses the analytics engine (single CTE query) but with an explicit static
 * comparison window instead of the app-wide year-over-year shift.
 */
export class FestivalService {
  constructor(private analyticsBuilder: IAnalyticsQueryBuilder) {}

  async getFestivalBalance(params: {
    currentFilters: FilterCondition[];
    comparisonFilters?: FilterCondition[];
    /** Raw event/comparison windows, needed for the to-date (mismo día) growth. */
    window?: { startDate: string; endDate: string; compareStartDate?: string; compareEndDate?: string };
  }): Promise<FestivalBalance> {
    const hasComparison = !!params.comparisonFilters;

    const [result, clientesUnicos, productosUnicos, toDate] = await Promise.all([
      this.analyticsBuilder.buildMultiTableYoYQuery({
        metrics: FESTIVAL_METRICS,
        currentPeriodFilters: params.currentFilters,
        ...(params.comparisonFilters ? { comparisonFilters: params.comparisonFilters } : {}),
      }),
      this.analyticsBuilder.buildDistinctCountQuery({
        sources: distinctSources('customer_id'),
        filters: params.currentFilters,
      }),
      this.analyticsBuilder.buildDistinctCountQuery({
        sources: distinctSources('product_id'),
        filters: params.currentFilters,
      }),
      this.salesGrowthToDate(params),
    ]);

    const sales = num(result['sales']);
    const grossMargin = num(result['gross_margin']);

    // Rappel: absolute rebate summed from transactions; % derived over sales.
    const rappel = num(result['rappel']);
    const rappelPct = sales !== 0 ? (rappel / sales) * 100 : 0;

    const margenRappel = grossMargin + rappel;
    const margenRappelPct = sales !== 0 ? (margenRappel / sales) * 100 : 0;

    // Margen total de la ventana comparada (mismas fórmulas sobre los _ly).
    const salesCompare = num(result['sales_ly']);
    const margenRappelPctCompare = hasComparison && salesCompare !== 0
      ? ((num(result['gross_margin_ly']) + num(result['rappel_ly'])) / salesCompare) * 100
      : null;
    const margenRappelPctGrowth = margenRappelPctCompare !== null && margenRappelPctCompare > 0
      ? ((margenRappelPct - margenRappelPctCompare) / margenRappelPctCompare) * 100
      : null;

    // Pedidos: comprometido = valor pendiente de facturar; promedio =
    // ventas totales / nº de pedidos (facturados + comprometidos, sin solape).
    const salesTotal = num(result['sales_total']);
    const pedidosCount = num(result['invoiced_orders']) + num(result['retained_orders']);
    const pedidoPromedio = pedidosCount > 0 ? salesTotal / pedidosCount : 0;
    const pedidosCountCompare = num(result['invoiced_orders_ly']) + num(result['retained_orders_ly']);
    const pedidoPromedioCompare = hasComparison && pedidosCountCompare > 0
      ? num(result['sales_total_last_year']) / pedidosCountCompare
      : null;

    return {
      sales_total: salesTotal,
      // No comparison window → comparison/growth come back null.
      sales_total_compare: hasComparison ? num(result['sales_total_last_year']) : null,
      sales_total_growth: hasComparison ? nullableNum(result['sales_total_vs_last_year']) : null,
      sales_total_growth_to_date: toDate.growth,
      sales_total_compare_to_date: toDate.salesCompareToDate,
      to_date_days: toDate.days,
      current_day: toDate.currentDay,
      event_days: toDate.total,

      gross_margin: grossMargin,
      gross_margin_pct: num(result['gross_margin_pct']),
      gross_margin_pct_compare: hasComparison ? nullableNum(result['gross_margin_pct_last_year']) : null,
      gross_margin_pct_growth: hasComparison ? nullableNum(result['gross_margin_pct_vs_last_year']) : null,

      rappel,
      rappel_pct: rappelPct,

      margen_rappel: margenRappel,
      margen_rappel_pct: margenRappelPct,
      margen_rappel_pct_compare: margenRappelPctCompare,
      margen_rappel_pct_growth: margenRappelPctGrowth,
      margen_rappel_pct_growth_to_date: toDate.margenGrowth,
      margen_rappel_pct_compare_to_date: toDate.margenCompareToDate,

      comprometido: num(result['orders']),
      pedidos_count: pedidosCount,
      pedido_promedio: pedidoPromedio,
      pedido_promedio_compare: pedidoPromedioCompare,

      clientes_unicos: clientesUnicos,
      productos_unicos: productosUnicos,

      ...(() => {
        // Budget 0 means "not applicable under the active filters" (the engine
        // zeroes the table) or simply no data → the frontend hides compliance.
        const budgetTotal = num(result['budget']);
        if (budgetTotal <= 0) return { presupuesto: null, presupuesto_meta: null, cumplimiento_ppto: null };
        const meta = budgetTotal * budgetProrateFactor(params.window);
        return {
          presupuesto: budgetTotal,
          presupuesto_meta: meta,
          cumplimiento_ppto: meta > 0 ? (salesTotal / meta) * 100 : null,
        };
      })(),
    };
  }

  /**
   * Festival listing: metrics grouped by an arbitrary dimension (defaults to
   * commercial provider), ordered by event sales. Same derived metrics as the
   * header cards.
   */
  async getFestivalList(params: {
    currentFilters: FilterCondition[];
    comparisonFilters?: FilterCondition[];
    groupBy?: string;
    /** Event window, used to prorate the budget target to the running day. */
    window?: { startDate: string; endDate: string };
  }): Promise<FestivalListRow[]> {
    const groupBy = params.groupBy || FESTIVAL_DEFAULT_GROUP_BY;

    // Comparison is irrelevant to the listing (only current-period metrics are shown).
    const [rows, clientesByGroup, productosByGroup] = await Promise.all([
      this.analyticsBuilder.buildGroupedMultiTableYoYQuery({
        metrics: FESTIVAL_METRICS,
        currentPeriodFilters: params.currentFilters,
        ...(params.comparisonFilters ? { comparisonFilters: params.comparisonFilters } : {}),
        groupBy,
        orderBy: 'sales_total',
        orderDirection: 'desc',
      }),
      this.analyticsBuilder.buildGroupedDistinctCountQuery({
        sources: distinctSources('customer_id'),
        filters: params.currentFilters,
        groupBy,
      }),
      this.analyticsBuilder.buildGroupedDistinctCountQuery({
        sources: distinctSources('product_id'),
        filters: params.currentFilters,
        groupBy,
      }),
    ]);

    const prorate = budgetProrateFactor(params.window);

    return rows.map((row) => {
      const sales = num(row['sales']);
      const rappel = num(row['rappel']);
      const rappelPct = sales !== 0 ? (rappel / sales) * 100 : 0;
      const grossMarginPct = num(row['gross_margin_pct']);
      const salesTotal = num(row['sales_total']);
      const pedidosCount = num(row['invoiced_orders']) + num(row['retained_orders']);
      const budget = num(row['budget']);
      const meta = budget * prorate;
      const rawId = String(row['id'] ?? '').trim();
      const rawName = String(row['name'] ?? '').trim();

      return {
        id: rawId,
        name: rawName === '' ? 'Sin Determinar' : rawName,
        sales_total: salesTotal,
        gross_margin_pct: grossMarginPct,
        rappel_pct: rappelPct,
        margen_rappel_pct: grossMarginPct + rappelPct,
        comprometido: num(row['orders']),
        pedido_promedio: pedidosCount > 0 ? salesTotal / pedidosCount : 0,
        clientes_unicos: clientesByGroup.get(rawId) ?? 0,
        productos_unicos: productosByGroup.get(rawId) ?? 0,
        presupuesto: budget > 0 ? budget : null,
        cumplimiento_ppto: meta > 0 ? (salesTotal / meta) * 100 : null,
      };
    });
  }

  /**
   * "Mismo día" pacing growths: the CLOSED days of the current event vs the
   * same day-indexes of the comparison event (day 1 vs day 1, day 2 vs day
   * 2…). The running day is excluded — comparing a partial day against a full
   * one would always understate. Implemented by re-running the balance query
   * with both windows truncated to the closed-day count, so sales and margin
   * use exactly the same formulas as the headline cards. Growths are null
   * until the first day closes, without a comparison window, or on a 0 base.
   */
  private async salesGrowthToDate(params: {
    currentFilters: FilterCondition[];
    comparisonFilters?: FilterCondition[];
    window?: { startDate: string; endDate: string; compareStartDate?: string; compareEndDate?: string };
  }): Promise<{
    growth: number | null;
    margenGrowth: number | null;
    salesCompareToDate: number | null;
    margenCompareToDate: number | null;
    days: number;
    currentDay: number;
    total: number;
  }> {
    const empty = { growth: null, margenGrowth: null, salesCompareToDate: null, margenCompareToDate: null };
    const w = params.window;
    if (!w) return { ...empty, days: 0, currentDay: 0, total: 0 };

    const { closed, currentDay, total } = closedEventDays(w.startDate, w.endDate);
    if (currentDay === 0 || !params.comparisonFilters || !w.compareStartDate) {
      return { ...empty, days: closed, currentDay, total };
    }

    // Truncate a window's upper date bound to its first `days` days. The
    // window bounds are the scoped lte conditions on the per-table date fields.
    const dateFields = new Set<string>(Object.values(FESTIVAL_DATE_FIELDS));
    const truncate = (filters: FilterCondition[], start: string, days: number): FilterCondition[] =>
      filters.map((f) =>
        dateFields.has(f.field) && f.operator === 'lte' && f.table
          ? { ...f, value: shiftDay(start, days - 1) }
          : f
      );

    const margenPct = (sales: number, margin: number, rappel: number): number =>
      sales !== 0 ? ((margin + rappel) / sales) * 100 : 0;

    // Two truncations: growth compares CLOSED days (partial running day would
    // always understate), while the "Festival anterior" display accumulates
    // through the RUNNING day so the reference grows with the event.
    const [growthResult, compareToDate] = await Promise.all([
      closed > 0
        ? this.analyticsBuilder.buildMultiTableYoYQuery({
            metrics: FESTIVAL_METRICS,
            currentPeriodFilters: truncate(params.currentFilters, w.startDate, closed),
            comparisonFilters: truncate(params.comparisonFilters, w.compareStartDate, closed),
          })
        : Promise.resolve(null),
      this.analyticsBuilder.buildMultiTableYoYQuery({
        metrics: FESTIVAL_METRICS,
        currentPeriodFilters: truncate(params.comparisonFilters, w.compareStartDate, currentDay),
      }),
    ]);

    let growth: number | null = null;
    let margenGrowth: number | null = null;
    if (growthResult) {
      const compareTotal = num(growthResult['sales_total_last_year']);
      growth = compareTotal > 0 ? ((num(growthResult['sales_total']) - compareTotal) / compareTotal) * 100 : null;
      const margenCur = margenPct(num(growthResult['sales']), num(growthResult['gross_margin']), num(growthResult['rappel']));
      const margenComp = margenPct(num(growthResult['sales_ly']), num(growthResult['gross_margin_ly']), num(growthResult['rappel_ly']));
      margenGrowth = margenComp > 0 ? ((margenCur - margenComp) / margenComp) * 100 : null;
    }

    return {
      growth,
      margenGrowth,
      salesCompareToDate: num(compareToDate['sales_total']),
      margenCompareToDate: margenPct(
        num(compareToDate['sales']),
        num(compareToDate['gross_margin']),
        num(compareToDate['rappel'])
      ),
      days: closed,
      currentDay,
      total,
    };
  }

  /**
   * Daily sales series (facturado + comprometido) over the event window:
   * transactions summed by order date, pedidos_retenidos by their row date.
   */
  async getFestivalDailySales(params: {
    currentFilters: FilterCondition[];
  }): Promise<FestivalDailyPoint[]> {
    const rows = await this.analyticsBuilder.buildDailySeriesQuery({
      sources: Object.entries(FESTIVAL_DATE_FIELDS).map(([table, dateField]) => ({
        table,
        dateField,
        valueField: 'sales_price',
      })),
      filters: params.currentFilters,
    });

    return rows.map((r) => ({ period: r.period, sales_total: num(r.value) }));
  }

  /**
   * Virtual "Marcas" listing: two aggregated rows (Marcas Exclusivas / Aliadas)
   * by ProveedorComercial membership. Clicking a row drills into products.
   */
  async getFestivalBrandGroups(params: {
    currentFilters: FilterCondition[];
  }): Promise<FestivalListRow[]> {
    const exclusiveFilters: FilterCondition[] = [
      ...params.currentFilters,
      ...brandGroupFilters('exclusivas'),
    ];
    const alliedFilters: FilterCondition[] = [
      ...params.currentFilters,
      ...brandGroupFilters('aliadas'),
    ];

    const [exclusivas, aliadas] = await Promise.all([
      this.bucketRow('exclusivas', 'Marcas Exclusivas', exclusiveFilters),
      this.bucketRow('aliadas', 'Marcas Aliadas', alliedFilters),
    ]);

    return [exclusivas, aliadas].sort((a, b) => b.sales_total - a.sales_total);
  }

  /**
   * Virtual "Rappel" listing: event sales split by whether the sale generates
   * rappel. Comprometido is excluded (it has no rappel information). Clicking
   * a row drills into the products sold with/without rappel.
   */
  async getFestivalRappelGroups(params: {
    currentFilters: FilterCondition[];
  }): Promise<FestivalListRow[]> {
    const [conRappel, sinRappel] = await Promise.all([
      this.bucketRow('con_rappel', 'Productos con Promoción', [...params.currentFilters, ...rappelGroupFilters('con_rappel')]),
      this.bucketRow('sin_rappel', 'Productos sin Promoción', [...params.currentFilters, ...rappelGroupFilters('sin_rappel')]),
    ]);

    return [conRappel, sinRappel].sort((a, b) => b.sales_total - a.sales_total);
  }

  /** Aggregate one virtual bucket into a listing row (same derived metrics). */
  private async bucketRow(
    id: string,
    name: string,
    filters: FilterCondition[]
  ): Promise<FestivalListRow> {
    const [result, clientesUnicos, productosUnicos] = await Promise.all([
      this.analyticsBuilder.buildMultiTableYoYQuery({
        metrics: FESTIVAL_METRICS,
        currentPeriodFilters: filters,
      }),
      this.analyticsBuilder.buildDistinctCountQuery({
        sources: distinctSources('customer_id'),
        filters,
      }),
      this.analyticsBuilder.buildDistinctCountQuery({
        sources: distinctSources('product_id'),
        filters,
      }),
    ]);
    const sales = num(result['sales']);
    const rappel = num(result['rappel']);
    const rappelPct = sales !== 0 ? (rappel / sales) * 100 : 0;
    const grossMarginPct = num(result['gross_margin_pct']);
    const salesTotal = num(result['sales_total']);
    const pedidosCount = num(result['invoiced_orders']) + num(result['retained_orders']);

    return {
      id,
      name,
      sales_total: salesTotal,
      gross_margin_pct: grossMarginPct,
      rappel_pct: rappelPct,
      margen_rappel_pct: grossMarginPct + rappelPct,
      comprometido: num(result['orders']),
      pedido_promedio: pedidosCount > 0 ? salesTotal / pedidosCount : 0,
      clientes_unicos: clientesUnicos,
      productos_unicos: productosUnicos,
      // Virtual buckets are not budget-splittable; the scoped bucket filters
      // zero the budget table.
      presupuesto: null,
      cumplimiento_ppto: null,
    };
  }
}
