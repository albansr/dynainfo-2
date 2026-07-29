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
  }): Promise<FestivalBalance> {
    const hasComparison = !!params.comparisonFilters;
    // Unique reach counts dedupe BETWEEN tables: a customer/product present in
    // both facturado and comprometido counts once.
    const distinctSources = (field: string) =>
      Object.keys(FESTIVAL_DATE_FIELDS).map((table) => ({ table, field }));

    const [result, clientesUnicos, productosUnicos] = await Promise.all([
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

      comprometido: num(result['orders']),
      pedidos_count: pedidosCount,
      pedido_promedio: pedidoPromedio,
      pedido_promedio_compare: pedidoPromedioCompare,

      clientes_unicos: clientesUnicos,
      productos_unicos: productosUnicos,
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
  }): Promise<FestivalListRow[]> {
    // Comparison is irrelevant to the listing (only current-period metrics are shown).
    const rows = await this.analyticsBuilder.buildGroupedMultiTableYoYQuery({
      metrics: FESTIVAL_METRICS,
      currentPeriodFilters: params.currentFilters,
      ...(params.comparisonFilters ? { comparisonFilters: params.comparisonFilters } : {}),
      groupBy: params.groupBy || FESTIVAL_DEFAULT_GROUP_BY,
      orderBy: 'sales_total',
      orderDirection: 'desc',
    });

    return rows.map((row) => {
      const sales = num(row['sales']);
      const rappel = num(row['rappel']);
      const rappelPct = sales !== 0 ? (rappel / sales) * 100 : 0;
      const grossMarginPct = num(row['gross_margin_pct']);
      const salesTotal = num(row['sales_total']);
      const pedidosCount = num(row['invoiced_orders']) + num(row['retained_orders']);
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
      };
    });
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
    const result = await this.analyticsBuilder.buildMultiTableYoYQuery({
      metrics: FESTIVAL_METRICS,
      currentPeriodFilters: filters,
    });
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
    };
  }
}
