import { Type, type Static } from '@sinclair/typebox';
import { BalanceQueryStringSchema, BalanceSheetResponseSchema, type BalanceQueryParams } from '../balance/balance.schemas.js';
import { ALLOWED_DIMENSIONS, type GroupByDimension } from '../../core/config/dimensions.config.js';
import { CUSTOMER_PRESETS, type CustomerPreset } from '../../core/config/customer-presets.config.js';

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
      search: Type.Optional(Type.String({ description: 'Case-insensitive substring search on the dimension id/name' })),
      customerPreset: Type.Optional(
        Type.Union(
          CUSTOMER_PRESETS.map((p) => Type.Literal(p)),
          { description: 'Customer preset lens (seller client listing). Default: todos' }
        )
      ),
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
    code: Type.Optional(
      Type.String({ description: 'Item code (IdItem) surfaced when grouping by product_id' })
    ),
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
  customerPreset?: CustomerPreset;
}

/**
 * Seller "Estado" headline counts (one per insight card). All scoped to the
 * seller and the selected window via the request filters.
 */
export const SellerStatusSchema = Type.Object({
  numerica: Type.Number({ description: 'Clients with a purchase in the current month' }),
  activos: Type.Number({ description: 'Total active clients (distinct historical buyers)' }),
  sinCompra: Type.Number({ description: 'Prior buyers with no purchase in the last 3 months' }),
  riesgo: Type.Number({ description: 'Riesgo clients (last 12m) with negative evolution' }),
  riesgoSales: Type.Number({ description: 'Sales of the Riesgo clients in the window' }),
  riesgoMarginPct: Type.Number({ description: 'Gross margin % of the Riesgo clients' }),
  promesa: Type.Number({ description: 'Clients classified Promesa in the window' }),
  promesaSales: Type.Number({ description: 'Sales of the Promesa clients in the window' }),
  promesaMarginPct: Type.Number({ description: 'Gross margin % of the Promesa clients' }),
  pesoTotal: Type.Number({ description: 'Clients that make up 80% of sales' }),
  pesoRetrocediendo: Type.Number({ description: 'Of the 80% clients, those declining vs last year' }),
  pesoDecline: Type.Number({ description: 'How much (currency) the declining key clients are down vs last year' }),
  pesoDeclineSharePct: Type.Number({ description: 'Share of total sales the declining key clients represent' }),
});

export type SellerStatus = Static<typeof SellerStatusSchema>;

/** Estado figures per seller (directors, admin, management): one row per seller in scope. */
export const SellerStatusBySellerSchema = Type.Array(
  Type.Composite([Type.Object({ seller_id: Type.String(), seller_name: Type.String() }), SellerStatusSchema])
);

export type SellerStatusBySeller = Static<typeof SellerStatusBySellerSchema>;
