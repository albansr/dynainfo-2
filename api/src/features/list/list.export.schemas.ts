import { Type, type Static } from '@sinclair/typebox';
import { BalanceQueryStringSchema } from '../balance/balance.schemas.js';
import { GroupByDimensionSchema, OrderDirectionSchema } from './list.schemas.js';

/**
 * Query parameters for the Excel export endpoint.
 *
 * Mirrors the list query (groupBy + dynamic filters + ordering) but drops
 * pagination and adds presentation params the frontend already computes for
 * the on-screen table, so the exported file matches the screen exactly.
 */
export const ListExportQueryStringSchema = Type.Composite(
  [
    BalanceQueryStringSchema,
    Type.Object({
      groupBy: GroupByDimensionSchema,
      orderBy: Type.Optional(Type.String({ description: 'Field to order by. Default: "sales_total"' })),
      orderDirection: Type.Optional(OrderDirectionSchema),
      preset: Type.Optional(Type.String({ description: 'Date-range preset; decides facturado-only vs facturado+comprometido sales' })),
      hideBudgetColumns: Type.Optional(Type.Boolean({ description: 'Hide budget + margin-budget columns' })),
      hideRetainedColumn: Type.Optional(Type.Boolean({ description: 'Hide retained (cartera) column' })),
      totalsLabel: Type.Optional(Type.String({ description: 'Label for the TOTAL row' })),
      reportTitle: Type.Optional(Type.String({ description: 'Report title shown at the top of the sheet' })),
      periodLabel: Type.Optional(Type.String({ description: 'Human-readable reporting period shown under the title' })),
      generatedLabel: Type.Optional(Type.String({ description: 'Date the export was generated (shown next to the period)' })),
      dimensionLabel: Type.Optional(Type.String({ description: 'Header label for the first (dimension) column' })),
      billingLabel: Type.Optional(Type.String({ description: 'Grouped header label for the billing/sales+budget group' })),
      currentYear: Type.Optional(Type.Integer({ description: 'Current period year (for column headers)' })),
      previousYear: Type.Optional(Type.Integer({ description: 'Previous period year (for column headers)' })),
      nameOverrides: Type.Optional(Type.String({ description: 'JSON object mapping raw dimension names to display names' })),
      filename: Type.Optional(Type.String({ description: 'Base filename (without extension) for the download' })),
    }),
  ],
  {
    additionalProperties: true,
    description: 'Query parameters for the list Excel export. Accepts dynamic filters beyond defined properties.',
  }
);

export type ListExportQueryString = Static<typeof ListExportQueryStringSchema>;
