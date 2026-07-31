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
    /**
     * Explicit comparison-period filters. When provided, the "previous" period
     * uses these verbatim instead of the default same-range-last-year shift.
     * Enables comparing against an arbitrary static date range (e.g. Festival).
     */
    comparisonFilters?: import('./filter-builder.js').FilterCondition[];
    facturadoOnly?: boolean;
  }): Promise<Record<string, number>>;

  /**
   * Build grouped multi-table year-over-year query
   */
  buildGroupedMultiTableYoYQuery(config: {
    metrics: readonly MetricConfig[];
    currentPeriodFilters: import('./filter-builder.js').FilterCondition[];
    /** Explicit comparison-period filters (see buildMultiTableYoYQuery). */
    comparisonFilters?: import('./filter-builder.js').FilterCondition[];
    groupBy: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    facturadoOnly?: boolean;
    search?: string;
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

  /**
   * Build time-series query grouped by day or month
   */
  buildTimeSeriesQuery(config: {
    filters: import('./filter-builder.js').FilterCondition[];
    granularity: 'day' | 'month';
  }): Promise<Array<{ period: string; sales: number; budget: number }>>;

  /**
   * Build a daily value series summed across several sources, each grouped by
   * its own date column (e.g. Festival: transactions by order_date plus
   * pedidos_retenidos by date). Filters honour FilterCondition.table scoping.
   */
  buildDailySeriesQuery(config: {
    sources: Array<{ table: string; dateField: string; valueField: string }>;
    filters: import('./filter-builder.js').FilterCondition[];
  }): Promise<Array<{ period: string; value: number }>>;

  /**
   * Count distinct values of a field across several tables, deduplicated
   * BETWEEN tables (a value present in more than one source counts once).
   * Filters honour FilterCondition.table scoping.
   */
  buildDistinctCountQuery(config: {
    sources: Array<{ table: string; field: string }>;
    filters: import('./filter-builder.js').FilterCondition[];
  }): Promise<number>;

  /**
   * Distinct-count per group value: same between-table dedup as
   * buildDistinctCountQuery, but grouped by a dimension column. Sources
   * lacking the dimension or the counted field contribute nothing.
   */
  buildGroupedDistinctCountQuery(config: {
    sources: Array<{ table: string; field: string }>;
    filters: import('./filter-builder.js').FilterCondition[];
    groupBy: string;
  }): Promise<Map<string, number>>;
}
