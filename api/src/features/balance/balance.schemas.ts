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
      Type.Number({ description: value.description }),
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
