import { BALANCE_METRICS, CALCULATED_METRICS } from '../../src/core/config/metrics.config.js';

/**
 * Test Data Builder - Generates dynamic test data from metrics configuration
 *
 * When you add a new metric to metrics.config.ts, tests will automatically
 * include it without any manual changes needed!
 */

/**
 * Generate mock query result (what ClickHouse returns)
 * Uses _ly suffix for last year values
 */
export function generateMockQueryResult(baseValues: Record<string, number> = {}): Record<string, number> {
  const result: Record<string, number> = {};

  // For each base metric, generate current, last year, and vs_last_year
  for (const metric of BALANCE_METRICS) {
    const alias = metric.alias;
    const currentValue = baseValues[alias] ?? 1000;
    const lastYearValue = baseValues[`${alias}_ly`] ?? 800;

    result[alias] = currentValue;
    result[`${alias}_ly`] = lastYearValue;

    // Calculate YoY percentage
    const yoyPct = lastYearValue !== 0
      ? ((currentValue - lastYearValue) / lastYearValue) * 100
      : 0;
    result[`${alias}_vs_last_year`] = Number(yoyPct.toFixed(2));
  }

  // Add calculated metrics
  for (const calcMetric of CALCULATED_METRICS) {
    result[calcMetric.name] = baseValues[calcMetric.name] ?? 100;
  }

  return result;
}

/**
 * Generate expected response (what buildDynamicResponse returns)
 * Uses _last_year suffix (not _ly)
 */
export function generateExpectedResponse(queryResult: Record<string, number>): Record<string, number> {
  const response: Record<string, number> = {};

  // Transform base metrics
  for (const metric of BALANCE_METRICS) {
    const alias = metric.alias;
    response[alias] = queryResult[alias] ?? 0;
    response[`${alias}_last_year`] = queryResult[`${alias}_ly`] ?? 0;
    response[`${alias}_vs_last_year`] = queryResult[`${alias}_vs_last_year`] ?? 0;
  }

  // Add calculated metrics (no transformation needed)
  for (const calcMetric of CALCULATED_METRICS) {
    response[calcMetric.name] = queryResult[calcMetric.name] ?? 0;
  }

  return response;
}

/**
 * Generate empty response (all metrics = 0)
 */
export function generateEmptyResponse(): Record<string, number> {
  return generateExpectedResponse({});
}

/**
 * Get all metric aliases for test assertions
 */
export function getAllMetricAliases(): string[] {
  return BALANCE_METRICS.map(m => m.alias);
}

/**
 * Get all calculated metric names for test assertions
 */
export function getAllCalculatedMetricNames(): string[] {
  return CALCULATED_METRICS.map(m => m.name);
}
