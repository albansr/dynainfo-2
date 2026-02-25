import type { MetricConfig } from './types.js';

export type { FilterCondition } from './filter-builder.js';

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
    currentPeriodFilters: import('./filter-builder.js').FilterCondition[];
  }): Promise<Record<string, number>>;

  /**
   * Build grouped multi-table year-over-year query
   */
  buildGroupedMultiTableYoYQuery(config: {
    metrics: readonly MetricConfig[];
    currentPeriodFilters: import('./filter-builder.js').FilterCondition[];
    groupBy: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }): Promise<Array<Record<string, number | string>>>;

  /**
   * Build query to get distinct values from a column
   */
  buildDistinctValuesQuery(config: {
    table: string;
    column: string;
    filters: import('./filter-builder.js').FilterCondition[];
    limit?: number;
    offset?: number;
  }): Promise<string[]>;
}
