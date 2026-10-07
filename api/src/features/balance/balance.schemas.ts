import { Type, type Static } from '@sinclair/typebox';
import { DateStringSchema } from '../../core/schemas/common.schemas.js';
import { generateMetricsSchema } from '../../core/config/metrics.config.js';
import type { FilterCondition } from '../../core/db/clickhouse/query/filter-builder.js';

/**
 * TypeBox schemas and types for balance endpoint
 */

/**
 * Query parameters for balance endpoint
 * Accepts dynamic filter parameters beyond defined properties
 */
export const BalanceQueryStringSchema = Type.Object(
  {
    startDate: Type.Optional(DateStringSchema),
    endDate: Type.Optional(DateStringSchema),
    facturadoOnly: Type.Optional(Type.Boolean({ description: 'Closed period: exclude comprometido from budget-relative metrics' })),
    includeUnits: Type.Optional(Type.Boolean({ description: 'Also return units and average unit cost (opt-in, product listings)' })),
  },
  {
    additionalProperties: true,
    description: 'Query parameters for balance endpoint. Accepts dynamic filters beyond startDate and endDate.',
  }
);

export type BalanceQueryString = Static<typeof BalanceQueryStringSchema>;

/**
 * Query parameters interface for balance sheet
 */
export interface BalanceQueryParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Balance sheet response schema
 * Dynamically generated from metrics configuration
 */
export const BalanceSheetResponseSchema = Type.Object(
  Object.fromEntries(
    Object.entries(generateMetricsSchema()).map(([key, value]) => [
      key,
      (key.endsWith('_vs_last_year') || key === 'gross_margin_pct_last_year')
        ? Type.Union([Type.Number(), Type.Null()], { description: value.description })
        : Type.Number({ description: value.description }),
    ])
  ),
  {
    $id: 'BalanceSheetResponse',
    description: 'Dynamic balance sheet response - automatically generated from metrics.config.ts',
    additionalProperties: Type.Number(),
  }
);

export type BalanceSheetResponse = Static<typeof BalanceSheetResponseSchema>;

/**
 * Helper to convert query parameters to filter conditions
 */
export function parseQueryParamsToFilters(params: BalanceQueryParams): FilterCondition[] {
  const filters: FilterCondition[] = [];

  if (params.startDate) {
    filters.push({
      field: 'date',
      operator: 'gte' as const,
      value: params.startDate,
    });
  }

  if (params.endDate) {
    filters.push({
      field: 'date',
      operator: 'lte' as const,
      value: params.endDate,
    });
  }

  return filters;
}

/**
 * Read a boolean flag from the query (e.g. facturadoOnly: closed periods leave
 * comprometido out). Accepts the boolean or its query-string form.
 */
export function parseBooleanParam(query: Record<string, unknown>, name: string): boolean {
  return query[name] === true || query[name] === 'true';
}

/**
 * Query parameters for the reach block and its "clientes sin compra" detail.
 * The period is required: "sin compra" is measured against the 12 months
 * before it. Accepts dynamic filters like /balance.
 */
export const BalanceReachQueryStringSchema = Type.Object(
  {
    startDate: DateStringSchema,
    endDate: DateStringSchema,
    facturadoOnly: Type.Optional(Type.Boolean({ description: 'Closed period: count invoiced sales only' })),
  },
  { additionalProperties: true }
);

export type BalanceReachQueryString = Static<typeof BalanceReachQueryStringSchema>;

/** Same as the reach query plus the Excel presentation labels (reserved in the filter parser). */
export const BalanceSinCompraExportQueryStringSchema = Type.Object(
  {
    startDate: DateStringSchema,
    endDate: DateStringSchema,
    facturadoOnly: Type.Optional(Type.Boolean()),
    reportTitle: Type.Optional(Type.String()),
    periodLabel: Type.Optional(Type.String()),
    generatedLabel: Type.Optional(Type.String()),
    filename: Type.Optional(Type.String()),
  },
  { additionalProperties: true }
);

/** Reach block: Items, Numérica and Clientes sin compra for the period. */
export const BalanceReachSchema = Type.Object({
  productos_unicos: Type.Number({ description: 'Items: distinct products sold in the period' }),
  clientes_unicos: Type.Number({ description: 'Numérica: distinct customers who bought in the period' }),
  clientes_sin_compra: Type.Number({
    description: 'Customers who bought in the 12 months before the period and have not bought in it',
  }),
});

export type BalanceReach = Static<typeof BalanceReachSchema>;
