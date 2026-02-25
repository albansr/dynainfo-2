import type { IAnalyticsQueryBuilder, FilterCondition } from '../../core/db/clickhouse/query/interfaces.js';
import type {
  BalanceSheetResponse,
  BalanceQueryParams,
} from './balance.schemas.js';
import { parseQueryParamsToFilters } from './balance.schemas.js';
import { BALANCE_METRICS } from '../../core/config/metrics.config.js';
import { buildDynamicResponse } from '../../core/utils/response-builder.js';

/**
 * Service for balance sheet business logic
 * Uses single optimized query with CTEs for maximum performance
 *
 * To add new metrics: Just add them to BALANCE_METRICS in metrics.config.ts
 * Everything else is handled automatically!
 *
 * Uses dependency injection for testability and loose coupling
 */
export class BalanceService {
  constructor(private analyticsBuilder: IAnalyticsQueryBuilder) {}

  /**
   * Get complete balance sheet (single raw object)
   * Single optimized query - all calculations in ClickHouse
   * Response is dynamically built from metrics configuration
   *
   * Accepts filters directly or via params for backward compatibility
   */
  async getBalanceSheet(
    params: BalanceQueryParams | { filters: FilterCondition[] }
  ): Promise<BalanceSheetResponse> {
    // Support both filter formats: direct filters or params to parse
    const filters = 'filters' in params
      ? params.filters
      : parseQueryParamsToFilters(params);

    // Execute single query with all metrics and YoY comparison
    const result = await this.analyticsBuilder.buildMultiTableYoYQuery({
      metrics: BALANCE_METRICS,
      currentPeriodFilters: filters,
    });

    // Build response using shared utility
    return buildDynamicResponse(result);
  }
}
