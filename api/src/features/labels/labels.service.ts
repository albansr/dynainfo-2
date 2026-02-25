import type { IAnalyticsQueryBuilder, FilterCondition } from '../../core/db/clickhouse/query/interfaces.js';
import type { LabelsQueryParams, LabelsResponse } from './labels.schemas.js';

/**
 * Service for labels endpoint business logic
 * Returns distinct values from a specified column, sorted alphabetically
 *
 * Uses dependency injection for testability and loose coupling
 */
export class LabelsService {
  constructor(private analyticsBuilder: IAnalyticsQueryBuilder) {}

  /**
   * Get distinct values for a column from transactions table
   * Results are filtered by optional date range and sorted A-Z
   *
   * @param params - Query parameters with column name and optional date filters
   * @returns Array of unique string values sorted alphabetically
   */
  async getLabels(params: LabelsQueryParams): Promise<LabelsResponse> {
    const { column, startDate, endDate, limit = 100, offset = 0 } = params;

    // Build filters for date range if provided
    const filters: FilterCondition[] = [];

    if (startDate) {
      filters.push({
        field: 'date',
        operator: 'gte',
        value: startDate,
      });
    }

    if (endDate) {
      filters.push({
        field: 'date',
        operator: 'lte',
        value: endDate,
      });
    }

    // Execute query to get distinct values with pagination
    const results = await this.analyticsBuilder.buildDistinctValuesQuery({
      table: 'transactions',
      column,
      filters,
      limit,
      offset,
    });

    return {
      data: results,
    };
  }
}
