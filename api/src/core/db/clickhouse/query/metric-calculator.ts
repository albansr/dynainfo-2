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
   * Handles dependencies between calculated metrics by processing in multiple passes.
   *
   * @param selects - Array to append calculated metric expressions
   * @param metricsByTable - Map of metrics grouped by table (to find CTE names)
   */
  addCalculatedMetrics(
    selects: string[],
    metricsByTable: Map<string, MetricConfig[]>,
    skippedTables?: Set<string>
  ): void {
    // Build map of alias -> CTE reference for base metrics
    const aliasToCte = this.buildAliasToCteMap(metricsByTable, skippedTables);

    // Track which calculated metrics have been added
    const addedMetrics = new Set<string>();

    // Process calculated metrics in multiple passes to handle dependencies
    let addedInLastPass = true;
    while (addedInLastPass) {
      addedInLastPass = false;

      for (const calculatedMetric of CALCULATED_METRICS) {
        // Skip if already added
        if (addedMetrics.has(calculatedMetric.name)) {
          continue;
        }

        // Check if all dependencies are available (either base metrics or already-added calculated metrics)
        const hasAllDependencies = calculatedMetric.dependencies.every(
          (dep) => aliasToCte.has(dep) || addedMetrics.has(dep)
        );

        if (!hasAllDependencies) {
          // Skip this metric for now, will try again in next pass
          continue;
        }

        // Replace {alias} placeholders with actual references
        let formula: string = calculatedMetric.formula;
        for (const dependency of calculatedMetric.dependencies) {
          let reference = aliasToCte.get(dependency);

          // If not in base metrics, check if it's a previously calculated metric
          if (!reference && addedMetrics.has(dependency)) {
            reference = dependency; // Just use the metric name directly
          }

          if (reference) {
            formula = formula.replace(
              new RegExp(`\\{${dependency}\\}`, 'g'),
              reference
            );
          }
        }

        // Add to selects and mark as added
        selects.push(`${formula} AS ${calculatedMetric.name}`);
        addedMetrics.add(calculatedMetric.name);
        addedInLastPass = true;
      }
    }
  }

  /**
   * Build map from metric alias to its CTE reference
   *
   * @param metricsByTable - Map of metrics grouped by table
   * @returns Map of alias -> full CTE.field reference
   */
  private buildAliasToCteMap(
    metricsByTable: Map<string, MetricConfig[]>,
    skippedTables?: Set<string>
  ): Map<string, string> {
    const map = new Map<string, string>();

    for (const [table, metrics] of metricsByTable) {
      for (const metric of metrics) {
        const alias = metric.alias;

        if (skippedTables?.has(table)) {
          // Table was skipped (no dimension column) — metrics are literal 0 in SELECT
          map.set(alias, alias);
          map.set(`${alias}_last_year`, `${alias}_ly`);
        } else {
          // Current period: transactions_current.sales
          map.set(alias, `${table}_current.${alias}`);

          // Last year: transactions_previous.sales_ly
          map.set(`${alias}_last_year`, `${table}_previous.${alias}_ly`);
        }
      }
    }

    return map;
  }
}
