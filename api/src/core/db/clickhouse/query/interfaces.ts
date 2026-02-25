import type { FilterCondition } from './filter-builder.js';
import type { MetricConfig } from './types.js';

/**
 * Dependency Injection interfaces
 * Allows for better testability and loose coupling
 */

/**
 * Analytics query builder interface
 * Decouples services from concrete implementation
 */
export interface IAnalyticsQueryBuilder {
  /**
   * Build multi-table year-over-year comparison query
   */
  buildMultiTableYoYQuery(config: {
    metrics: readonly MetricConfig[];
    currentPeriodFilters: FilterCondition[];
  }): Promise<Record<string, number>>;

  /**
   * Build grouped multi-table year-over-year query
   */
  buildGroupedMultiTableYoYQuery(config: {
    metrics: readonly MetricConfig[];
    currentPeriodFilters: FilterCondition[];
    groupBy: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<Record<string, number | string>>>;

  /**
   * Build query to get distinct values from a column
   */
  buildDistinctValuesQuery(config: {
    table: string;
    column: string;
    filters: FilterCondition[];
  }): Promise<string[]>;
}
