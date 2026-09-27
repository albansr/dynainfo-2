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
  ): Promise<Array<Record<string, number | string>>> {
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
    return kept;
  }

  private async getPesoList(
    filters: FilterCondition[],
    params: { page: number; limit: number; facturadoOnly: boolean }
  ): Promise<ListResponse> {
    const kept = await this.computePesoKeptRows(filters, params.facturadoOnly);

    const start = (params.page - 1) * params.limit;
    const items = kept
      .slice(start, start + params.limit)
      .map((row) => this.toListItemResponse(row));

    return {
      data: items,
      meta: {
        groupBy: 'customer_id',
        total: kept.length,
        count: items.length,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(kept.length / params.limit),
      },
    };
  }

  /**
   * Seller "Estado" headline counts, one per insight card. Every count is scoped
   * to the seller + window via `filters`; "sin compra" excludes window buyers from
   * the seller's historical buyers (filters without the date bounds), and "peso
   * retrocediendo" counts the 80%-of-sales clients whose sales fell vs last year.
   */
  async getSellerStatus(
    params: ListQueryParams & { filters?: FilterCondition[]; facturadoOnly?: boolean }
  ): Promise<SellerStatus> {
    const facturadoOnly = params.facturadoOnly ?? false;
    const currentFilters = params.filters ?? parseQueryParamsToFilters(params);
    // Historical buyers: same filters (seller scope, etc.) minus the date window.
    const universeFilters = currentFilters.filter((f) => f.field !== 'date');
    const sources = [{ table: 'transactions', field: 'customer_id' }];

    const [numerica, sinCompra, riesgo, promesa, pesoKept] = await Promise.all([
      this.analyticsBuilder.buildDistinctCountQuery({ sources, filters: currentFilters }),
      this.analyticsBuilder.buildDistinctCountExcludingQuery({
        universe: { table: 'transactions', field: 'customer_id', filters: universeFilters },
        exclude: { sources, filters: currentFilters },
      }),
      this.analyticsBuilder.buildDistinctCountQuery({
        sources, filters: [...currentFilters, ...customerPresetFilters('riesgo')],
      }),
      this.analyticsBuilder.buildDistinctCountQuery({
        sources, filters: [...currentFilters, ...customerPresetFilters('promesa')],
      }),
      this.computePesoKeptRows(currentFilters, facturadoOnly),
    ]);

    const declineOf = (row: Record<string, number | string>): number =>
      typeof row['sales_total_vs_last_year'] === 'number' ? row['sales_total_vs_last_year'] : 0;

    return {
      numerica,
      sinCompra,
      riesgo,
      promesa,
      pesoTotal: pesoKept.length,
      pesoRetrocediendo: pesoKept.filter((row) => declineOf(row) < 0).length,
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
