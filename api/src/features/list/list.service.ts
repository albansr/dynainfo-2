import type { IAnalyticsQueryBuilder, FilterCondition } from '../../core/db/clickhouse/query/interfaces.js';
import type {
  ListQueryParams,
  ListResponse,
  ListItemResponse,
} from './list.schemas.js';
import { parseQueryParamsToFilters } from '../balance/balance.schemas.js';
import { BALANCE_METRICS } from '../../core/config/metrics.config.js';
import { buildDynamicResponse } from '../../core/utils/response-builder.js';

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
    params: ListQueryParams & { filters?: FilterCondition[]; facturadoOnly?: boolean }
  ): Promise<ListResponse> {
    // Support both filter formats: direct filters or params to parse
    const filters = params.filters ?? parseQueryParamsToFilters(params);
    const {
      groupBy,
      page = 1,
      limit = 50,
      orderBy = 'sales_total',
      orderDirection = 'desc',
      facturadoOnly = false,
    } = params;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Execute single query with pagination and total count via window function
    const results = await this.analyticsBuilder.buildGroupedMultiTableYoYQuery({
      metrics: BALANCE_METRICS,
      currentPeriodFilters: filters,
      groupBy,
      limit,
      offset,
      orderBy,
      orderDirection,
      facturadoOnly,
    });

    // Extract total count from first row (window function returns same value in all rows)
    const total = results.length > 0 && '_total_count' in results[0]!
      ? Number(results[0]!['_total_count'])
      : results.length;

    // Build array of responses using shared utility
    const items: ListItemResponse[] = results.map((result) => this.toListItemResponse(result));

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
    const filters = params.filters ?? parseQueryParamsToFilters(params);
    const {
      groupBy,
      orderBy = 'sales_total',
      orderDirection = 'desc',
      facturadoOnly = false,
    } = params;

    const results = await this.analyticsBuilder.buildGroupedMultiTableYoYQuery({
      metrics: BALANCE_METRICS,
      currentPeriodFilters: filters,
      groupBy,
      limit: EXPORT_ROW_HARD_CAP + 1,
      orderBy,
      orderDirection,
      facturadoOnly,
    });

    if (results.length > EXPORT_ROW_HARD_CAP) {
      throw new ExportTooLargeError(results.length);
    }

    return results.map((result) => this.toListItemResponse(result));
  }

  /**
   * Map a raw grouped query row into a ListItemResponse.
   * Shared by the paginated list and the export path.
   */
  private toListItemResponse(result: Record<string, number | string>): ListItemResponse {
    const rawId = result['id']?.toString() ?? '';
    const id = rawId.trim() === '' ? 'Sin Determinar' : rawId;
    const rawName = result['name']?.toString() ?? '';
    const name = rawName.trim() === '' ? 'Sin Determinar' : rawName;
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
      ...buildDynamicResponse(numericResult),
    } as unknown as ListItemResponse;
  }
}
