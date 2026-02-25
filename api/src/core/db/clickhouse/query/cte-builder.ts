import type { MetricConfig } from './types.js';

/**
 * CTEBuilder - Specialized class for building Common Table Expressions (CTEs)
 *
 * Responsibilities:
 * - Generate CTEs for current period metrics
 * - Generate CTEs for previous year metrics
 * - Handle both aggregated (no GROUP BY) and grouped (with GROUP BY) CTEs
 * - Return structured CTE data for SQL assembly
 *
 * This class focuses solely on CTE construction, delegating:
 * - Filter building to FilterBuilder
 * - SQL assembly to SQLAssembler
 * - Query orchestration to AnalyticsQueryBuilder
 */

/**
 * CTE data structure returned by builder
 */
export interface CTEData {
  cteName: string;
  cteSQL: string;
  metrics: MetricConfig[];
}

export class CTEBuilder {
  private tablePrefix: string;

  constructor(tablePrefix: string = '') {
    this.tablePrefix = tablePrefix;
  }

  /**
   * Build CTEs for non-grouped query (aggregated results)
   *
   * Creates pairs of CTEs for each table:
   * - {table}_current: Current period aggregated metrics
   * - {table}_previous: Previous year aggregated metrics
   *
   * @param metricsByTable - Map of metrics grouped by table
   * @param currentWhere - WHERE clause for current period
   * @param previousWhere - WHERE clause for previous year
   * @returns Array of CTE definitions
   */
  buildCTEs(
    metricsByTable: Map<string, MetricConfig[]>,
    currentWhere: string,
    previousWhere: string
  ): CTEData[] {
    const ctes: CTEData[] = [];

    for (const [table, tableMetrics] of metricsByTable) {
      const tableName = `${this.tablePrefix}${table}`;

      // Current period CTE
      const currentMetrics = tableMetrics
        .map((m) => `${m.aggregation}(${m.field}) AS ${m.alias}`)
        .join(', ');

      ctes.push({
        cteName: `${table}_current`,
        cteSQL: `${table}_current AS (
  SELECT ${currentMetrics}
  FROM ${tableName}
${currentWhere}
)`,
        metrics: tableMetrics,
      });

      // Previous year CTE
      const previousMetrics = tableMetrics
        .map((m) => `${m.aggregation}(${m.field}) AS ${m.alias}_ly`)
        .join(', ');

      ctes.push({
        cteName: `${table}_previous`,
        cteSQL: `${table}_previous AS (
  SELECT ${previousMetrics}
  FROM ${tableName}
${previousWhere}
)`,
        metrics: tableMetrics,
      });
    }

    return ctes;
  }

  /**
   * Build CTEs for grouped query (with GROUP BY dimension)
   *
   * Creates pairs of CTEs for each table with GROUP BY clause:
   * - {table}_current: Current period metrics grouped by dimension
   * - {table}_previous: Previous year metrics grouped by dimension
   *
   * @param metricsByTable - Map of metrics grouped by table
   * @param currentWhere - WHERE clause for current period
   * @param previousWhere - WHERE clause for previous year
   * @param groupBy - Dimension field to group by
   * @returns Array of CTE definitions
   */
  buildGroupedCTEs(
    metricsByTable: Map<string, MetricConfig[]>,
    currentWhere: string,
    previousWhere: string,
    groupBy: string
  ): CTEData[] {
    const ctes: CTEData[] = [];

    for (const [table, tableMetrics] of metricsByTable) {
      const tableName = `${this.tablePrefix}${table}`;

      // Current period CTE with GROUP BY
      const currentMetrics = tableMetrics
        .map((m) => `${m.aggregation}(${m.field}) AS ${m.alias}`)
        .join(', ');

      ctes.push({
        cteName: `${table}_current`,
        cteSQL: `${table}_current AS (
  SELECT ${groupBy}, ${currentMetrics}
  FROM ${tableName}
${currentWhere}
  GROUP BY ${groupBy}
)`,
        metrics: tableMetrics,
      });

      // Previous year CTE with GROUP BY
      const previousMetrics = tableMetrics
        .map((m) => `${m.aggregation}(${m.field}) AS ${m.alias}_ly`)
        .join(', ');

      ctes.push({
        cteName: `${table}_previous`,
        cteSQL: `${table}_previous AS (
  SELECT ${groupBy}, ${previousMetrics}
  FROM ${tableName}
${previousWhere}
  GROUP BY ${groupBy}
)`,
        metrics: tableMetrics,
      });
    }

    return ctes;
  }
}
