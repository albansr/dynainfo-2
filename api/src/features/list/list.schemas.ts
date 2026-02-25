import { Type, type Static } from '@sinclair/typebox';
import { BalanceQueryStringSchema, BalanceSheetResponseSchema, type BalanceQueryParams } from '../balance/balance.schemas.js';
import { ALLOWED_DIMENSIONS, type GroupByDimension } from '../../core/config/dimensions.config.js';

/**
 * TypeBox schemas and types for list endpoint
 * Schemas are DYNAMICALLY GENERATED from config files
 */

/**
 * Group by dimension schema
 * Generated from ALLOWED_DIMENSIONS in dimensions.config.ts
 */
export const GroupByDimensionSchema = Type.Union(
  ALLOWED_DIMENSIONS.map((dim) => Type.Literal(dim)),
  {
    description: 'Dimension to group by',
  }
);

export type { GroupByDimension };

/**
 * Order direction schema
 */
export const OrderDirectionSchema = Type.Union([
  Type.Literal('asc'),
  Type.Literal('desc'),
], {
  description: 'Sort direction',
  default: 'desc',
});

export type OrderDirection = Static<typeof OrderDirectionSchema>;

/**
 * Query parameters for list endpoint
 * Inherits additionalProperties from BalanceQueryStringSchema to accept dynamic filters
 */
export const ListQueryStringSchema = Type.Composite(
  [
    BalanceQueryStringSchema,
    Type.Object({
      groupBy: GroupByDimensionSchema,
      page: Type.Optional(Type.Integer({ minimum: 1, default: 1, description: 'Page number (1-indexed)' })),
      limit: Type.Optional(Type.Integer({ minimum: 20, maximum: 100, default: 50, description: 'Items per page (min 20, max 100)' })),
      orderBy: Type.Optional(Type.String({ description: 'Field to order by (metric alias or "name"). Default: "sales"' })),
      orderDirection: Type.Optional(OrderDirectionSchema),
    }),
  ],
  {
    additionalProperties: true,
    description: 'Query parameters for list endpoint. Accepts dynamic filters beyond defined properties.',
  }
);

export type ListQueryString = Static<typeof ListQueryStringSchema>;

/**
 * List item response schema
 * Contains dimension id, name, and all balance metrics
 */
export const ListItemResponseSchema = Type.Composite([
  Type.Object({
    id: Type.String({ description: 'ID of the groupBy dimension' }),
    name: Type.String({ description: 'Name/label of the groupBy dimension' }),
  }),
  BalanceSheetResponseSchema,
], {
  $id: 'ListItemResponse',
  additionalProperties: Type.Union([Type.Number(), Type.String()]),
});

export type ListItemResponse = Static<typeof ListItemResponseSchema>;

/**
 * List metadata schema
 */
export const ListMetadataSchema = Type.Object({
  groupBy: GroupByDimensionSchema,
  total: Type.Number({ description: 'Total number of items across all pages' }),
  count: Type.Number({ description: 'Number of items in current page' }),
  page: Type.Number({ description: 'Current page number' }),
  limit: Type.Number({ description: 'Items per page' }),
  totalPages: Type.Number({ description: 'Total number of pages' }),
}, {
  $id: 'ListMetadata',
});

export type ListMetadata = Static<typeof ListMetadataSchema>;

/**
 * List response schema
 */
export const ListResponseSchema = Type.Object({
  data: Type.Array(ListItemResponseSchema),
  meta: ListMetadataSchema,
}, {
  $id: 'ListResponse',
});

export type ListResponse = Static<typeof ListResponseSchema>;

/**
 * Query parameters interface for list endpoint
 * Extends BalanceQueryParams with groupBy dimension and pagination
 */
export interface ListQueryParams extends BalanceQueryParams {
  groupBy: GroupByDimension;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: OrderDirection;
}
