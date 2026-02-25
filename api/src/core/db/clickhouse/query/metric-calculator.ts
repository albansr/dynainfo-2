import type { MetricConfig } from './types.js';
import { CALCULATED_METRICS } from '../../../config/metrics.config.js';

/**
 * MetricCalculator - Handles calculated metrics logic (CONFIG-DRIVEN)
 *
 * Responsibilities:
 * - Generate SQL for calculated metrics dynamically from configuration
 * - Determine which calculated metrics are available based on base metrics
 * - Replace formula placeholders with correct CTE references
 *
 * This class reads from CALCULATED_METRICS in metrics.config.ts.
 * To add a new calculated metric, just add it to that config array.
 * No changes needed here!
 */
export class MetricCalculator {
  /**
   * Add calculated metrics to SELECT clause (FULLY DYNAMIC)
   *
   * Reads from CALCULATED_METRICS configuration and generates SQL expressions.
   * Uses ClickHouse's if() function for safe division (already in formulas).
   *
   * @param selects - Array to append calculated metric expressions
   * @param metricsByTable - Map of metrics grouped by table (to find CTE names)
   */
  addCalculatedMetrics(
    selects: string[],
    metricsByTable: Map<string, MetricConfig[]>
  ): void {
    // Build map of alias -> CTE name for fast lookup
    const aliasToCte = this.buildAliasToCteMap(metricsByTable);

    // For each configured calculated metric
    for (const calculatedMetric of CALCULATED_METRICS) {
      // Check if all dependencies are available
      const hasAllDependencies = calculatedMetric.dependencies.every(
        (dep) => aliasToCte.has(dep)
      );

      if (!hasAllDependencies) {
        // Skip this metric if not all dependencies are present
        continue;
      }

      // Replace {alias} placeholders with actual CTE references
      let formula: string = calculatedMetric.formula;
      for (const dependency of calculatedMetric.dependencies) {
        const cte = aliasToCte.get(dependency);
        if (cte) {
          // Replace {alias} with cte.alias (e.g., {sales} -> transactions_current.sales)
          formula = formula.replace(
            new RegExp(`\\{${dependency}\\}`, 'g'),
            `${cte}.${dependency}`
          );
        }
      }

      // Add to selects with metric name
      selects.push(`${formula} AS ${calculatedMetric.name}`);
    }
  }

  /**
   * Build map from metric alias to its CTE name
   *
   * @param metricsByTable - Map of metrics grouped by table
   * @returns Map of alias -> CTE name (e.g., 'sales' -> 'transactions_current')
   */
  private buildAliasToCteMap(
    metricsByTable: Map<string, MetricConfig[]>
  ): Map<string, string> {
    const map = new Map<string, string>();

    for (const [table, metrics] of metricsByTable) {
      for (const metric of metrics) {
        // Current period CTE name
        const cteName = `${table}_current`;
        map.set(metric.alias, cteName);
      }
    }

    return map;
  }
}
