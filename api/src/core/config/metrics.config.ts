import type { MetricConfig } from '../db/clickhouse/query/types.js';

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
    // Full month budget (NOT prorated by elapsed business days). The budget CTE
    // skips proration for aliases ending in "_full".
    table: 'budget',
    field: 'sales_price',
    aggregation: 'sum',
    alias: 'budget_full',
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
  {
    table: 'cartera',
    field: 'sales_price',
    aggregation: 'sum',
    alias: 'cartera',
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

/**
 * Units and cost metrics, only meaningful (and only queried) when listing
 * products. Kept out of BALANCE_METRICS so every other balance/list query does
 * not pay for them. Pending orders (comprometido) carry their quantity in
 * `cantidadComprometida`: it is the quantity their `sales_price` is priced on
 * (implied unit price matches invoiced sales), in the same unit as
 * `transactions.units`; `cantidadProcesada` stays 0 until an order is invoiced.
 * `cost_price` is a line total in both tables.
 */
export const PRODUCT_UNIT_METRICS = [
  {
    table: 'transactions',
    field: 'units',
    aggregation: 'sum',
    alias: 'units',
  },
  {
    table: 'transactions',
    field: 'cost_price',
    aggregation: 'sum',
    alias: 'cost',
  },
  {
    table: 'pedidos_retenidos',
    field: 'cantidadComprometida',
    aggregation: 'sum',
    alias: 'orders_units',
  },
  {
    table: 'pedidos_retenidos',
    field: 'cost_price',
    aggregation: 'sum',
    alias: 'orders_cost',
  },
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
  /**
   * When true, the `orders` (comprometido) term is dropped from the formula
   * for closed periods (facturadoOnly). Budget-relative metrics should only
   * count facturado once the period is closed. See MetricCalculator.
   */
  readonly facturadoSensitive?: boolean;
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
    dependencies: ['sales', 'orders', 'budget'],
    formula: 'if({budget} != 0, ((({sales} + {orders}) - {budget}) / {budget}) * 100, 0)',
    facturadoSensitive: true,
  },
  {
    name: 'budget_achievement_pct',
    description: 'Budget achievement %',
    dependencies: ['sales', 'orders', 'budget'],
    formula: 'if({budget} != 0, (({sales} + {orders}) / {budget}) * 100, 0)',
    facturadoSensitive: true,
  },
  {
    name: 'budget_achievement_full_pct',
    description: 'Budget achievement % against the full (non-prorated) month budget',
    dependencies: ['sales', 'orders', 'budget_full'],
    formula: 'if({budget_full} != 0, (({sales} + {orders}) / {budget_full}) * 100, 0)',
    facturadoSensitive: true,
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
  {
    name: 'gross_margin_pct_last_year',
    description: 'Gross margin percentage from last year',
    dependencies: ['gross_margin_last_year', 'sales_last_year'],
    formula: 'if({sales_last_year} > 0, ({gross_margin_last_year} / {sales_last_year}) * 100, NULL)',
  },
  {
    // Variation in percentage POINTS, not relative growth: 20% → 25% reads +5.
    // NULL propagates from gross_margin_pct_last_year when there is no base.
    name: 'gross_margin_pct_vs_last_year',
    description: 'YoY variation in percentage points for gross margin percentage',
    dependencies: ['gross_margin_pct', 'gross_margin_pct_last_year'],
    formula: '{gross_margin_pct} - {gross_margin_pct_last_year}',
  },
  {
    name: 'cartera_compliance_pct',
    description: 'Cartera compliance % ((sales + orders + cartera) / budget * 100)',
    dependencies: ['sales', 'orders', 'cartera', 'budget'],
    formula: 'if({budget} != 0, (({sales} + {orders} + {cartera}) / {budget}) * 100, 0)',
    facturadoSensitive: true,
  },
  {
    name: 'sales_total',
    description: 'Total ventas (facturado + comprometido)',
    dependencies: ['sales', 'orders'],
    formula: '{sales} + {orders}',
  },
  {
    name: 'sales_total_last_year',
    description: 'Total ventas año anterior',
    dependencies: ['sales_last_year', 'orders_last_year'],
    formula: '{sales_last_year} + {orders_last_year}',
  },
  {
    name: 'sales_total_vs_last_year',
    description: 'YoY variance % for total ventas',
    dependencies: ['sales_total', 'sales_total_last_year'],
    formula: 'if({sales_total_last_year} > 0, (({sales_total} - {sales_total_last_year}) / {sales_total_last_year}) * 100, NULL)',
  },
  {
    // Product listings only (needs PRODUCT_UNIT_METRICS). Mirrors sales_total:
    // facturado + comprometido; closed periods read `units` instead.
    name: 'units_total',
    description: 'Total units (facturado + comprometido)',
    dependencies: ['units', 'orders_units'],
    formula: '{units} + {orders_units}',
  },
  {
    // Average cost per invoiced unit (pairs with `sales` / `units`).
    name: 'avg_unit_cost',
    description: 'Average cost per unit, facturado only',
    dependencies: ['cost', 'units'],
    formula: 'if({units} != 0, {cost} / {units}, 0)',
  },
  {
    // Average cost per unit over facturado + comprometido (pairs with
    // `sales_total` / `units_total`).
    name: 'avg_unit_cost_total',
    description: 'Average cost per unit (facturado + comprometido)',
    dependencies: ['cost', 'orders_cost', 'units', 'orders_units'],
    formula: 'if(({units} + {orders_units}) != 0, ({cost} + {orders_cost}) / ({units} + {orders_units}), 0)',
  },
  {
    // Average selling price per invoiced unit (pairs with `sales` / `units`).
    name: 'avg_unit_price',
    description: 'Average price per unit, facturado only',
    dependencies: ['sales', 'units'],
    formula: 'if({units} != 0, {sales} / {units}, 0)',
  },
  {
    // Average selling price per unit over facturado + comprometido (pairs with `sales_total` / `units_total`).
    name: 'avg_unit_price_total',
    description: 'Average price per unit (facturado + comprometido)',
    dependencies: ['sales', 'orders', 'units', 'orders_units'],
    formula: 'if(({units} + {orders_units}) != 0, ({sales} + {orders}) / ({units} + {orders_units}), 0)',
  },
  {
    name: 'avg_unit_price_last_year',
    description: 'Average price per unit last year, facturado only',
    dependencies: ['sales_last_year', 'units_last_year'],
    formula: 'if({units_last_year} != 0, {sales_last_year} / {units_last_year}, 0)',
  },
  {
    name: 'avg_unit_price_total_last_year',
    description: 'Average price per unit last year (facturado + comprometido)',
    dependencies: ['sales_last_year', 'orders_last_year', 'units_last_year', 'orders_units_last_year'],
    formula: 'if(({units_last_year} + {orders_units_last_year}) != 0, ({sales_last_year} + {orders_last_year}) / ({units_last_year} + {orders_units_last_year}), 0)',
  },
  {
    // Same as units_total over the comparison period (evolution in product listings).
    name: 'units_total_last_year',
    description: 'Total units last year (facturado + comprometido)',
    dependencies: ['units_last_year', 'orders_units_last_year'],
    formula: '{units_last_year} + {orders_units_last_year}',
  },
  {
    // 0 without a base (not NULL): extra list fields are serialized as plain numbers.
    name: 'avg_unit_cost_last_year',
    description: 'Average cost per unit last year, facturado only',
    dependencies: ['cost_last_year', 'units_last_year'],
    formula: 'if({units_last_year} != 0, {cost_last_year} / {units_last_year}, 0)',
  },
  {
    name: 'avg_unit_cost_total_last_year',
    description: 'Average cost per unit last year (facturado + comprometido)',
    dependencies: ['cost_last_year', 'orders_cost_last_year', 'units_last_year', 'orders_units_last_year'],
    formula: 'if(({units_last_year} + {orders_units_last_year}) != 0, ({cost_last_year} + {orders_cost_last_year}) / ({units_last_year} + {orders_units_last_year}), 0)',
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
