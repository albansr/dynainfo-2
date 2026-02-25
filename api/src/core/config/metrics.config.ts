import type { MetricConfig } from '../db/query/types.js';

/**
 * ========================================================================
 * CONFIGURATION SECTION - Change metrics and calculated metrics here!
 * ========================================================================
 *
 * This is the SINGLE POINT OF CONFIGURATION for all metrics.
 * Everything else in this file is generated from these two arrays.
 */

// ============ BASE METRICS CONFIGURATION ============

/**
 * Base metrics configuration
 *
 * To add a new base metric:
 * 1. Add it to BALANCE_METRICS array below
 * 2. That's it! Everything else updates automatically:
 *    - Types are generated automatically
 *    - response-builder.ts will return it
 *    - API responses will include it
 *    - Swagger docs will show it
 */
export const BALANCE_METRICS = [
  {
    table: 'budget',
    field: 'sales_price',
    aggregation: 'sum',
    alias: 'budget',
  },
  {
    table: 'budget',
    field: 'cost_price',
    aggregation: 'sum',
    alias: 'budget_cost',
  },
  {
    table: 'transactions',
    field: 'sales_price',
    aggregation: 'sum',
    alias: 'sales',
  },
  {
    table: 'transactions',
    field: 'gross_margin',
    aggregation: 'sum',
    alias: 'gross_margin',
  },
  {
    table: 'pedidos_retenidos',
    field: 'sales_price',
    aggregation: 'sum',
    alias: 'orders',
  },
  // Add more metrics here as needed
  // Example:
  // {
  //   table: 'costs',
  //   field: 'cost_price',
  //   aggregation: 'sum',
  //   alias: 'costs',
  // },
] as const satisfies readonly MetricConfig[];

// ============ CALCULATED METRICS CONFIGURATION ============

/**
 * Calculated metric configuration interface
 */
export interface CalculatedMetricConfig {
  readonly name: string;
  readonly description: string;
  readonly dependencies: readonly string[]; // Base metric aliases needed
  readonly formula: string; // SQL formula with {alias} placeholders
}

/**
 * Calculated metrics configuration
 * These are derived metrics calculated from base metrics
 *
 * To add a new calculated metric:
 * 1. Add it to CALCULATED_METRICS array below
 * 2. That's it! Everything updates automatically:
 *    - MetricCalculator will generate SQL for it
 *    - Types are generated automatically
 *    - API responses will include it
 *    - Swagger docs will show it
 *
 * Formula placeholders:
 * - Use {alias} to reference base metrics (e.g., {sales}, {budget})
 * - MetricCalculator will replace them with correct CTE references
 * - Use ClickHouse functions: if(), round(), etc.
 */
export const CALCULATED_METRICS = [
  {
    name: 'sales_vs_budget',
    description: 'Sales vs budget variance %',
    dependencies: ['sales', 'budget'],
    formula: 'if({budget} != 0, (({sales} - {budget}) / {budget}) * 100, 0)',
  },
  {
    name: 'budget_achievement_pct',
    description: 'Budget achievement %',
    dependencies: ['sales', 'budget'],
    formula: 'if({budget} != 0, ({sales} / {budget}) * 100, 0)',
  },
  {
    name: 'order_fulfillment_pct',
    description: 'Order fulfillment %',
    dependencies: ['sales', 'orders'],
    formula: 'if({sales} != 0, ({orders} / {sales}) * 100, 0)',
  },
  {
    name: 'gross_margin_pct',
    description: 'Gross margin percentage',
    dependencies: ['gross_margin', 'sales'],
    formula: 'if({sales} != 0, ({gross_margin} / {sales}) * 100, 0)',
  },
  {
    name: 'budget_gross_margin_pct',
    description: 'Budget gross margin percentage',
    dependencies: ['budget', 'budget_cost'],
    formula: 'if({budget} != 0, (({budget} - {budget_cost}) / {budget}) * 100, 0)',
  },
  // Add more calculated metrics here as needed
  // Example:
  // {
  //   name: 'profit_margin',
  //   description: 'Profit margin %',
  //   dependencies: ['sales', 'costs'],
  //   formula: 'if({sales} != 0, (({sales} - {costs}) / {sales}) * 100, 0)',
  // },
] as const satisfies readonly CalculatedMetricConfig[];

/**
 * ========================================================================
 * UTILITY FUNCTIONS - Generated from configuration above
 * ========================================================================
 * Do not modify these unless you're changing the metric system itself
 */

/**
 * Get all metric aliases (for runtime)
 */
export function getAllMetricAliases(): string[] {
  return BALANCE_METRICS.map((m) => m.alias);
}

/**
 * Get all calculated metric names (for runtime)
 */
export function getAllCalculatedMetricNames(): string[] {
  return CALCULATED_METRICS.map((m) => m.name);
}

/**
 * Get complete list of all metric fields that will appear in the response (for runtime)
 */
export function getAllResponseFields(): string[] {
  const baseFields: string[] = [];

  // For each metric, add: current, last_year, vs_last_year
  for (const metric of BALANCE_METRICS) {
    baseFields.push(metric.alias);
    baseFields.push(`${metric.alias}_last_year`);
    baseFields.push(`${metric.alias}_vs_last_year`);
  }

  // Add calculated metrics
  baseFields.push(...getAllCalculatedMetricNames());

  return baseFields;
}

/**
 * ========================================================================
 * TYPE EXPORTS - Generated types for compile-time safety
 * ========================================================================
 * These types are automatically updated when you modify configuration
 */

/**
 * Extract metric alias types from configuration
 * This type is automatically updated when you add metrics to BALANCE_METRICS
 */
export type BaseMetricAlias = typeof BALANCE_METRICS[number]['alias'];

/**
 * Extract calculated metric types from configuration
 * This type is automatically updated when you add metrics to CALCULATED_METRICS
 */
export type CalculatedMetricName = typeof CALCULATED_METRICS[number]['name'];

/**
 * Generate all field names for a base metric (current, last_year, vs_last_year)
 */
export type BaseMetricFields<T extends string> =
  | T
  | `${T}_last_year`
  | `${T}_vs_last_year`;

/**
 * All metric field names that will appear in the response
 * This type is automatically generated from BALANCE_METRICS and CALCULATED_METRICS
 */
export type AllMetricFieldNames =
  | BaseMetricFields<BaseMetricAlias>
  | CalculatedMetricName;

/**
 * ========================================================================
 * SCHEMA GENERATION - For Fastify/TypeBox integration
 * ========================================================================
 */

/**
 * Generate Fastify JSON Schema for all metrics
 * Used in route definitions to avoid duplicating metric definitions
 *
 * This function dynamically generates the schema properties based on
 * BALANCE_METRICS and CALCULATED_METRICS configuration.
 *
 * @returns JSON Schema properties object for Fastify validation
 */
export function generateMetricsSchema(): Record<string, { type: string; description: string }> {
  const schema: Record<string, { type: string; description: string }> = {};

  // Add all base metrics (current, last_year, vs_last_year)
  for (const metric of BALANCE_METRICS) {
    const alias = metric.alias;

    // Current period value
    schema[alias] = {
      type: 'number',
      description: `Current period ${alias}`,
    };

    // Last year value
    schema[`${alias}_last_year`] = {
      type: 'number',
      description: `Previous year ${alias}`,
    };

    // Year-over-year variance
    schema[`${alias}_vs_last_year`] = {
      type: 'number',
      description: `YoY variance % for ${alias}`,
    };
  }

  // Add calculated metrics from configuration
  for (const calculatedMetric of CALCULATED_METRICS) {
    schema[calculatedMetric.name] = {
      type: 'number',
      description: calculatedMetric.description,
    };
  }

  return schema;
}
