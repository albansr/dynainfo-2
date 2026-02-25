/**
 * Metric configuration for temporal comparison queries
 *
 * Defines how to aggregate a metric from a specific table
 */
export interface MetricConfig {
  table: string;
  field: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  alias: string;
}
