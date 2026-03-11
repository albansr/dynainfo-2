import { Type, type Static } from '@sinclair/typebox';
import { DateStringSchema } from '../../core/schemas/common.schemas.js';
import type { FilterCondition } from '../../core/db/clickhouse/query/filter-builder.js';

/**
 * Query parameters for qube6 segment analysis endpoint
 * Accepts dynamic filter parameters beyond defined properties
 */
export const Qube6QueryStringSchema = Type.Object(
  {
    groupBy: Type.String({ description: 'Dimension to group by (e.g., customer_id, seller_id, product_id)' }),
    id: Type.String({ description: 'Entity ID to analyze' }),
    startDate: Type.Optional(DateStringSchema),
    endDate: Type.Optional(DateStringSchema),
  },
  {
    additionalProperties: true,
    description: 'Query parameters for qube6 segment analysis. Accepts dynamic filters beyond defined params.',
  }
);

export type Qube6QueryString = Static<typeof Qube6QueryStringSchema>;

/**
 * Single segment classification (Value, Sales, Profit, Quality)
 */
const SegmentClassificationSchema = Type.Object({
  fine_y: Type.String({ description: 'Y-axis classification (A-D, or X for new entities in Sales)' }),
  fine_x: Type.String({ description: 'X-axis classification (A-D)' }),
  short: Type.String({ description: 'Short classification label' }),
  fine_id: Type.Number({ description: 'Fine classification ID (1-16, or negative for new entities)' }),
});

/**
 * Qube6 analysis response with 4 segment classifications
 */
export const Qube6ResponseSchema = Type.Object({
  value: SegmentClassificationSchema,
  sales: SegmentClassificationSchema,
  profit: SegmentClassificationSchema,
  quality: SegmentClassificationSchema,
});

export type Qube6Response = Static<typeof Qube6ResponseSchema>;

/**
 * Parse date query params into filter conditions
 * Reuses the same pattern as balance's parseQueryParamsToFilters
 */
export function parseQueryParamsToDateFilters(params: {
  startDate?: string;
  endDate?: string;
}): FilterCondition[] {
  const filters: FilterCondition[] = [];

  if (params.startDate) {
    filters.push({ field: 'date', operator: 'gte', value: params.startDate });
  }

  if (params.endDate) {
    filters.push({ field: 'date', operator: 'lte', value: params.endDate });
  }

  return filters;
}
