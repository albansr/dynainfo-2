import { BALANCE_METRICS, getAllCalculatedMetricNames } from '../config/metrics.config.js';
import type { BalanceSheetResponse } from '../../features/balance/balance.schemas.js';

/**
 * Build dynamic response from query result
 * This utility is used by both balance (single object) and list (array) endpoints
 *
 * Automatically includes all configured metrics with:
 * - Current period value
 * - Last year value
 * - Year-over-year variance
 * - All calculated metrics
 *
 * This keeps the response structure consistent across all endpoints
 */
export function buildDynamicResponse(
  result: Record<string, number | null>
): BalanceSheetResponse {
  const response: Record<string, number | null> = {};

  // Add all base metrics (current, last_year, vs_last_year)
  for (const metric of BALANCE_METRICS) {
    const alias = metric.alias;

    // Current period value
    response[alias] = result[alias] ?? 0;

    // Last year value
    response[`${alias}_last_year`] = result[`${alias}_ly`] ?? 0;

    // Year-over-year variance
    response[`${alias}_vs_last_year`] = result[`${alias}_vs_last_year`] ?? null;
  }

  // Add all calculated metrics (growth metrics keep null when base <= 0 → 'N/A')
  for (const calculatedMetricName of getAllCalculatedMetricNames()) {
    const fallback = (calculatedMetricName.endsWith('_vs_last_year') || calculatedMetricName === 'gross_margin_pct_last_year') ? null : 0;
    response[calculatedMetricName] = result[calculatedMetricName] ?? fallback;
  }

  return response as BalanceSheetResponse;
}

/**
 * Build array of dynamic responses from multiple query results
 * Used by list endpoint to return multiple items with same structure
 */
export function buildDynamicResponseArray(
  results: Array<Record<string, number | null>>
): BalanceSheetResponse[] {
  return results.map((result) => buildDynamicResponse(result));
}
