import type { IAnalyticsQueryBuilder, FilterCondition } from '../../core/db/clickhouse/query/interfaces.js';
import type {
  ListQueryParams,
  ListResponse,
  ListItemResponse,
  SellerStatus,
} from './list.schemas.js';
import { parseQueryParamsToFilters } from '../balance/balance.schemas.js';
import { BALANCE_METRICS } from '../../core/config/metrics.config.js';
import { buildDynamicResponse } from '../../core/utils/response-builder.js';
import {
  BRAND_GROUP,
  BRAND_BUCKETS,
  brandGroupFilters,
  expandBrandGroupFilters,
} from '../../core/config/brand-groups.config.js';
import {
  DEFAULT_CUSTOMER_PRESET,
  PESO_SALES_SHARE,
  customerPresetFilters,
} from '../../core/config/customer-presets.config.js';

/**
 * Hard cap on the number of rows an Excel export may contain.
 * Bounds query cost, memory and file size for the export endpoint.
 */
export const EXPORT_ROW_HARD_CAP = 20_000;

/**
 * Thrown when an export would exceed EXPORT_ROW_HARD_CAP rows.
 * The route layer maps this to a 400 response.
 */
export class ExportTooLargeError extends Error {
  constructor(public readonly rowCount: number) {
    super(
      `La exportación supera el límite de ${EXPORT_ROW_HARD_CAP.toLocaleString('es-CO')} filas. Ajusta los filtros o el rango de fechas.`
    );
    this.name = 'ExportTooLargeError';
  }
}

/**
 * Service for list endpoint business logic
 * Returns array of items (grouped by dimension) with same structure as balance
 *
 * Uses the same dynamic response builder as balance endpoint
 * To add new metrics: Just add them to BALANCE_METRICS in metrics.config.ts
 *
 * Uses dependency injection for testability and loose coupling
 */
export class ListService {
  constructor(private analyticsBuilder: IAnalyticsQueryBuilder) {}

  /**
   * Get list of balance sheets grouped by dimension
   * Each item has the same structure as the balance endpoint
   *
   * Accepts filters directly or via params for backward compatibility
   */
  async getBalanceList(
    params: ListQueryParams & { filters?: FilterCondition[]; facturadoOnly?: boolean; search?: string }
  ): Promise<ListResponse> {
    const {
      groupBy,
      page = 1,
      limit = 50,
      orderBy = 'sales_total',
      orderDirection = 'desc',
      facturadoOnly = false,
      search,
      customerPreset = DEFAULT_CUSTOMER_PRESET,
    } = params;

    // Support both filter formats: direct filters or params to parse. A drilled
    // brand bucket arrives as a `brand_group` filter — expand it into the real
    // provider conditions; then apply the customer preset lens (Riesgo/Promesa).
    const filters = [
      ...expandBrandGroupFilters(params.filters ?? parseQueryParamsToFilters(params)),
      ...customerPresetFilters(customerPreset),
    ];

    // Virtual "Marcas" grouping: two provider buckets computed in the service.
    if (groupBy === BRAND_GROUP) {
      return this.getBrandGroupList(filters, { page, limit, orderBy, orderDirection, facturadoOnly });
    }

    // "Peso en cumplimiento": the clients that concentrate the bulk of the budget.
    if (customerPreset === 'peso') {
      return this.getPesoList(filters, { page, limit, facturadoOnly });
    }

    // "Sin compra": the seller's historical buyers with no purchase in the window.
    if (customerPreset === 'sin_compra') {
      return this.getSinCompraList(filters, { page, limit });
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Execute the grouped metrics query and, when listing products, the item-code
    // (IdItem) lookup concurrently. The code column surfaces the internal item
    // code next to product_id without threading it through the metrics query.
    const [results, codeByGroup] = await Promise.all([
      this.analyticsBuilder.buildGroupedMultiTableYoYQuery({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: filters,
        groupBy,
        limit,
        offset,
        orderBy,
        orderDirection,
        facturadoOnly,
        ...(search && { search }),
      }),
      this.getCodeByGroup(groupBy, filters),
    ]);

    // Extract total count from first row (window function returns same value in all rows)
    const firstRow = results[0];
    const total = firstRow && '_total_count' in firstRow
      ? Number(firstRow['_total_count'])
      : results.length;

    // Build array of responses using shared utility
    const items: ListItemResponse[] = results.map((result) => this.toListItemResponse(result, codeByGroup));

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    return {
      data: items,
      meta: {
        groupBy,
        total,
        count: items.length,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Get the FULL (unpaginated) grouped list for Excel export.
   *
   * Requests up to EXPORT_ROW_HARD_CAP + 1 rows so ClickHouse itself bounds
   * the result; if more than the cap come back, throws ExportTooLargeError
   * (mapped to 400 by the route) before any mapping/workbook work happens.
   */
  async getBalanceListForExport(
    params: ListQueryParams & { filters?: FilterCondition[]; facturadoOnly?: boolean }
  ): Promise<ListItemResponse[]> {
    const {
      groupBy,
      orderBy = 'sales_total',
      orderDirection = 'desc',
      facturadoOnly = false,
      customerPreset = DEFAULT_CUSTOMER_PRESET,
    } = params;
    const filters = [
      ...expandBrandGroupFilters(params.filters ?? parseQueryParamsToFilters(params)),
      ...customerPresetFilters(customerPreset),
    ];

    // Virtual "Marcas" grouping exports its two buckets (always within the cap).
    if (groupBy === BRAND_GROUP) {
      const { data } = await this.getBrandGroupList(filters, {
        page: 1,
        limit: BRAND_BUCKETS.length,
        orderBy,
        orderDirection,
        facturadoOnly,
      });
      return data;
    }

    // "Peso en cumplimiento" exports its whole Pareto subset.
    if (customerPreset === 'peso') {
      const { data } = await this.getPesoList(filters, {
        page: 1,
        limit: EXPORT_ROW_HARD_CAP,
        facturadoOnly,
      });
      return data;
    }

    // "Sin compra" exports its whole exclusion set.
    if (customerPreset === 'sin_compra') {
      const { data } = await this.getSinCompraList(filters, { page: 1, limit: EXPORT_ROW_HARD_CAP });
      return data;
    }

    const [results, codeByGroup] = await Promise.all([
      this.analyticsBuilder.buildGroupedMultiTableYoYQuery({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: filters,
        groupBy,
        limit: EXPORT_ROW_HARD_CAP + 1,
        orderBy,
        orderDirection,
        facturadoOnly,
      }),
      this.getCodeByGroup(groupBy, filters),
    ]);

    if (results.length > EXPORT_ROW_HARD_CAP) {
      throw new ExportTooLargeError(results.length);
    }

    return results.map((result) => this.toListItemResponse(result, codeByGroup));
  }

  /**
   * Virtual "Marcas" listing: two aggregated rows (Marcas Exclusivas / Aliadas)
   * by commercial-provider membership. Each bucket is a single ungrouped YoY
   * aggregate over the same provider filter the Marcas dashboards use, so a
   * bucket total matches its dashboard. Clicking a row drills into its providers
   * (DRILL_TARGET.brand_group → ProveedorComercial), expanded back on the server.
   */
  private async getBrandGroupList(
    filters: FilterCondition[],
    params: {
      page: number;
      limit: number;
      orderBy: string;
      orderDirection: 'asc' | 'desc';
      facturadoOnly: boolean;
    }
  ): Promise<ListResponse> {
    const buckets = await Promise.all(
      BRAND_BUCKETS.map(async (bucket) => ({
        bucket,
        result: await this.analyticsBuilder.buildMultiTableYoYQuery({
          metrics: BALANCE_METRICS,
          currentPeriodFilters: [...filters, ...brandGroupFilters(bucket.id)],
          facturadoOnly: params.facturadoOnly,
        }),
      }))
    );

    const direction = params.orderDirection === 'asc' ? 1 : -1;
    const sortValue = (row: Record<string, number>): number => {
      const value = row[params.orderBy];
      return typeof value === 'number' ? value : 0;
    };
    buckets.sort((a, b) => (sortValue(a.result) - sortValue(b.result)) * direction);

    const items = buckets.map(({ bucket, result }) =>
      this.toListItemResponse({ ...result, id: bucket.id, name: bucket.name })
    );

    return {
      data: items,
      meta: {
        groupBy: BRAND_GROUP,
        total: items.length,
        count: items.length,
        page: params.page,
        limit: params.limit,
        totalPages: 1,
      },
    };
  }

  /**
   * "Peso en cumplimiento" listing: the clients that, ordered by sales desc,
   * cumulatively make up PESO_SALES_SHARE of the total sales — the few clients
   * whose performance carries the seller's compliance. (Budget has no per-customer
   * breakdown, so the ranking is by sales.) Computed over the full grouped result
   * (the seller's own clients, well within the export cap) so the Pareto cut and
   * pagination stay correct.
   */
  private async computePesoKeptRows(
    filters: FilterCondition[],
    facturadoOnly: boolean
  ): Promise<{ kept: Array<Record<string, number | string>>; totalSales: number }> {
    const rows = await this.analyticsBuilder.buildGroupedMultiTableYoYQuery({
      metrics: BALANCE_METRICS,
      currentPeriodFilters: filters,
      groupBy: 'customer_id',
      limit: EXPORT_ROW_HARD_CAP,
      orderBy: 'sales_total',
      orderDirection: 'desc',
      facturadoOnly,
    });

    const salesOf = (row: Record<string, number | string>): number =>
      typeof row['sales_total'] === 'number' ? row['sales_total'] : 0;
    const totalSales = rows.reduce((sum, row) => sum + salesOf(row), 0);
    const threshold = totalSales * PESO_SALES_SHARE;

    // Keep the sales-desc clients until their cumulative sales reach the
    // threshold. With no sales at all, keep nothing.
    const kept: Array<Record<string, number | string>> = [];
    let cumulative = 0;
    for (const row of rows) {
      if (totalSales <= 0) break;
      kept.push(row);
      cumulative += salesOf(row);
      if (cumulative >= threshold) break;
    }
    return { kept, totalSales };
  }

  /**
   * "Sin compra" listing: the seller's historical buyers (same filters minus the
   * date window) minus those who bought in the window, via the exclusion-details
   * query. These clients have no sales in the window, so only id (NIT) and name
   * come back; metrics render as zero.
   */
  private async getSinCompraList(
    filters: FilterCondition[],
    params: { page: number; limit: number }
  ): Promise<ListResponse> {
    const universeFilters = filters.filter((f) => f.field !== 'date');
    const rows = await this.analyticsBuilder.buildDistinctDetailsExcludingQuery({
      universe: { table: 'transactions', keyField: 'customer_id', filters: universeFilters },
      attributes: ['customer_name'],
      dateField: 'date',
      exclude: { sources: [{ table: 'transactions', field: 'customer_id' }], filters },
      orderBy: 'customer_name',
    });

    const start = (params.page - 1) * params.limit;
    const items = rows
      .slice(start, start + params.limit)
      .map((row) =>
        this.toListItemResponse({
          id: String(row['customer_id'] ?? ''),
          name: String(row['customer_name'] ?? ''),
        })
      );

    return {
      data: items,
      meta: {
        groupBy: 'customer_id',
        total: rows.length,
        count: items.length,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(rows.length / params.limit),
      },
    };
  }

  /**
   * "Clientes clave" (peso) listing — two windows on purpose:
   *  - The SET (who the key declining clients are, and their ABC position) is fixed
   *    to the last 12 months, so the roster and ranking never move with the
   *    temporality selector and always match the Estado card.
   *  - The FIGURES (sales, margin…) are read over the requested window, so the
   *    seller can switch temporality to see this month's / this year's numbers for
   *    those same clients. `includeAllGroups` keeps every key client visible even
   *    when they have no activity in the chosen window (they render as zeros).
   */
  private async getPesoList(
    filters: FilterCondition[],
    params: { page: number; limit: number; facturadoOnly: boolean }
  ): Promise<ListResponse> {
    const baseFilters = filters.filter((f) => f.field !== 'date');
    const requestDate = filters.filter((f) => f.field === 'date');

    // SET (fixed 12m): the key clients (80% of sales) ranked by billing, kept only
    // when declining vs last year — each carrying its ABC position within the 80%.
    const { kept } = await this.computePesoKeptRows(
      [...baseFilters, ...ListService.rollingWindow(12)],
      params.facturadoOnly
    );
    const declining = kept
      .map((row, index) => ({ id: this.rowId(row), name: this.rowName(row), abcRank: index + 1, row }))
      .filter(({ row }) => ListService.numField(row, 'sales_total_vs_last_year') < 0);

    if (declining.length === 0) {
      return this.emptyList(params);
    }

    const nameById = new Map(declining.map((d) => [d.id, d.name]));
    const ids = declining.map((d) => d.id);

    // FIGURES over the requested window for exactly those clients.
    const metricRows = await this.analyticsBuilder.buildGroupedMultiTableYoYQuery({
      metrics: BALANCE_METRICS,
      currentPeriodFilters: [...baseFilters, ...requestDate, { field: 'customer_id', operator: 'in', value: ids }],
      groupBy: 'customer_id',
      limit: EXPORT_ROW_HARD_CAP,
      orderBy: 'sales_total',
      orderDirection: 'desc',
      facturadoOnly: params.facturadoOnly,
      includeAllGroups: true,
    });
    const metricById = new Map(metricRows.map((row) => [this.rowId(row), row]));

    // Emit the full roster in ABC order; clients absent from the window are zeros.
    const ordered = declining.map(({ id, abcRank }) => {
      const row = metricById.get(id) ?? { id, name: nameById.get(id) ?? '' };
      return { ...this.toListItemResponse(row), abcRank };
    });

    const start = (params.page - 1) * params.limit;
    const items = ordered.slice(start, start + params.limit);

    return {
      data: items,
      meta: {
        groupBy: 'customer_id',
        total: ordered.length,
        count: items.length,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(ordered.length / params.limit),
      },
    };
  }

  private rowId(row: Record<string, number | string>): string {
    return String(row['id'] ?? '');
  }

  private rowName(row: Record<string, number | string>): string {
    return String(row['name'] ?? '');
  }

  private emptyList(params: { page: number; limit: number }): ListResponse {
    return {
      data: [],
      meta: { groupBy: 'customer_id', total: 0, count: 0, page: params.page, limit: params.limit, totalPages: 0 },
    };
  }

  private static numField(row: Record<string, number | string>, key: string): number {
    const value = row[key];
    return typeof value === 'number' ? value : 0;
  }

  /** A rolling [now - monthsBack, now] date window as filter conditions. */
  private static rollingWindow(monthsBack: number): FilterCondition[] {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - monthsBack);
    const fmt = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return [
      { field: 'date', operator: 'gte', value: fmt(start) },
      { field: 'date', operator: 'lte', value: fmt(now) },
    ];
  }

  /**
   * Aggregate a classification lens over its window: clients (grouped) matching
   * the evolution direction, with their billing and sales-weighted margin. Used
   * for the Estado riesgo (declining) and promesa (growing) cards.
   */
  private async getClassificationStat(
    filters: FilterCondition[],
    evolution: 'declining' | 'growing'
  ): Promise<{ count: number; sales: number; marginPct: number }> {
    const rows = await this.analyticsBuilder.buildGroupedMultiTableYoYQuery({
      metrics: BALANCE_METRICS,
      currentPeriodFilters: filters,
      groupBy: 'customer_id',
      limit: EXPORT_ROW_HARD_CAP,
      orderBy: 'sales_total',
      orderDirection: 'desc',
      facturadoOnly: false,
    });
    const match = rows.filter((row) => {
      const evo = ListService.numField(row, 'sales_total_vs_last_year');
      return evolution === 'declining' ? evo < 0 : evo > 0;
    });
    const sales = match.reduce((sum, row) => sum + ListService.numField(row, 'sales_total'), 0);
    const margin = match.reduce((sum, row) => sum + ListService.numField(row, 'gross_margin'), 0);
    return { count: match.length, sales, marginPct: sales > 0 ? (margin / sales) * 100 : 0 };
  }

  /**
   * Seller "Estado" figures. The Estado page does not react to the global
   * temporality: each criterion has its own fixed rolling window (computed here).
   * - sin compra: historical buyers with no purchase in the last 3 months.
   * - riesgo: Riesgo-classified clients (last 12m) with negative evolution.
   * - promesa: Promesa-classified clients (last 12m) with positive evolution.
   * - peso: the 80%-of-sales clients (last 12m), how many are declining.
   * Each figure carries the clients' billing (and margin) over its window.
   */
  async getSellerStatus(
    params: ListQueryParams & { filters?: FilterCondition[] }
  ): Promise<SellerStatus> {
    const requestFilters = params.filters ?? parseQueryParamsToFilters(params);
    // Seller scope (and any non-date filter); the Estado windows are fixed here.
    const baseFilters = requestFilters.filter((f) => f.field !== 'date');
    const sources = [{ table: 'transactions', field: 'customer_id' }];

    const now = new Date();
    const monthsBack = (n: number): Date => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - n);
      return d;
    };
    const fmt = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const windowFrom = (start: Date): FilterCondition[] => [
      { field: 'date', operator: 'gte', value: fmt(start) },
      { field: 'date', operator: 'lte', value: fmt(now) },
    ];
    const currentMonth = windowFrom(new Date(now.getFullYear(), now.getMonth(), 1));
    const last3m = windowFrom(monthsBack(3));
    const last12m = windowFrom(monthsBack(12));

    const [numerica, activos, sinCompra, riesgoStat, promesaStat, peso] = await Promise.all([
      // Coverage: clients who bought this month, over the whole active base.
      this.analyticsBuilder.buildDistinctCountQuery({ sources, filters: [...baseFilters, ...currentMonth] }),
      this.analyticsBuilder.buildDistinctCountQuery({ sources, filters: baseFilters }),
      // Historical buyers minus those who bought in the last 3 months.
      this.analyticsBuilder.buildDistinctCountExcludingQuery({
        universe: { table: 'transactions', field: 'customer_id', filters: baseFilters },
        exclude: { sources, filters: [...baseFilters, ...last3m] },
      }),
      this.getClassificationStat([...baseFilters, ...last12m, ...customerPresetFilters('riesgo')], 'declining'),
      this.getClassificationStat([...baseFilters, ...last12m, ...customerPresetFilters('promesa')], 'growing'),
      this.computePesoKeptRows([...baseFilters, ...last12m], false),
    ]);

    // Declining key clients: of the 80%-of-sales set, those down vs last year.
    const declining = peso.kept.filter((row) => ListService.numField(row, 'sales_total_vs_last_year') < 0);
    const pesoDecline = declining.reduce(
      (sum, row) =>
        sum + Math.max(0, ListService.numField(row, 'sales_total_last_year') - ListService.numField(row, 'sales_total')),
      0
    );
    const decliningSales = declining.reduce((sum, row) => sum + ListService.numField(row, 'sales_total'), 0);

    return {
      numerica,
      activos,
      sinCompra,
      riesgo: riesgoStat.count,
      riesgoSales: riesgoStat.sales,
      riesgoMarginPct: riesgoStat.marginPct,
      promesa: promesaStat.count,
      promesaSales: promesaStat.sales,
      promesaMarginPct: promesaStat.marginPct,
      pesoTotal: peso.kept.length,
      pesoRetrocediendo: declining.length,
      pesoDecline,
      pesoDeclineSharePct: peso.totalSales > 0 ? (decliningSales / peso.totalSales) * 100 : 0,
    };
  }

  /**
   * When grouping by product, resolve each product_id to its item code (IdItem)
   * so the listing can show the internal code sellers recognise next to the SKU.
   * Returns undefined for non-product groupings (no code column is shown).
   */
  private getCodeByGroup(
    groupBy: string,
    filters: FilterCondition[]
  ): Promise<Map<string, string> | undefined> {
    if (groupBy !== 'product_id') return Promise.resolve(undefined);
    return this.analyticsBuilder.buildGroupedAttributeQuery({
      table: 'transactions',
      attribute: 'IdItem',
      filters,
      groupBy,
    });
  }

  /**
   * Map a raw grouped query row into a ListItemResponse.
   * Shared by the paginated list and the export path.
   */
  private toListItemResponse(
    result: Record<string, number | string>,
    codeByGroup?: Map<string, string>
  ): ListItemResponse {
    const rawId = result['id']?.toString() ?? '';
    const id = rawId.trim() === '' ? 'Sin Determinar' : rawId;
    const rawName = result['name']?.toString() ?? '';
    const name = rawName.trim() === '' ? 'Sin Determinar' : rawName;
    const code = codeByGroup?.get(rawId.trim());
    const numericResult: Record<string, number> = {};

    // Filter out non-numeric values and internal fields for buildDynamicResponse
    for (const [key, value] of Object.entries(result)) {
      if (key !== 'id' && key !== 'name' && key !== '_total_count' && typeof value === 'number') {
        numericResult[key] = value;
      }
    }

    return {
      id,
      name,
      ...(code ? { code } : {}),
      ...buildDynamicResponse(numericResult),
    } as unknown as ListItemResponse;
  }
}
