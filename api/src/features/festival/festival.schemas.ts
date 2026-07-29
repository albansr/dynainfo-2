import { Type, type Static } from '@sinclair/typebox';
import { DateStringSchema } from '../../core/schemas/common.schemas.js';
import type { MetricConfig } from '../../core/db/clickhouse/query/types.js';
import type { FilterCondition } from '../../core/db/clickhouse/query/filter-builder.js';

/**
 * TypeBox schemas and types for the Festival Virtual endpoint.
 *
 * The festival dashboard tracks sales of a concrete event over a fixed date
 * window and compares it against another fixed window (not the app-wide
 * year-over-year comparison). It has no period presets and no budget.
 */

/**
 * Base metrics summed for the festival, per period.
 *
 * Deliberately a small subset of the global BALANCE_METRICS (no budget/cartera):
 * only what the festival cards need.
 *
 * `rappel` is the absolute rebate value per transaction (Float64, summable).
 * The rappel % is derived as sum(rappel)/sum(sales)*100 in the service — the
 * per-row `rappel_pct` column is a rate that must not be summed.
 */
export const FESTIVAL_METRICS = [
  { table: 'transactions', field: 'sales_price', aggregation: 'sum', alias: 'sales' },
  { table: 'transactions', field: 'gross_margin', aggregation: 'sum', alias: 'gross_margin' },
  { table: 'transactions', field: 'rappel', aggregation: 'sum', alias: 'rappel' },
  { table: 'pedidos_retenidos', field: 'sales_price', aggregation: 'sum', alias: 'orders' },
  // Distinct order counts (no double counting: invoiced and retained order ids
  // don't overlap). Feed `pedidos_count` and `pedido_promedio`.
  { table: 'transactions', field: 'Pedido', aggregation: 'uniqExact', alias: 'invoiced_orders' },
  { table: 'pedidos_retenidos', field: 'pedidoId', aggregation: 'uniqExact', alias: 'retained_orders' },
] as const satisfies readonly MetricConfig[];

/**
 * Query parameters for the festival endpoint.
 * - startDate / endDate: the event window
 * - compareStartDate / compareEndDate: the static window to compare against
 * - any other param: dynamic filters (comma-separated for multiple values)
 */
export const FestivalQueryStringSchema = Type.Object(
  {
    startDate: DateStringSchema,
    endDate: DateStringSchema,
    // Optional: when omitted, there is no comparison (comparison fields come back null).
    compareStartDate: Type.Optional(DateStringSchema),
    compareEndDate: Type.Optional(DateStringSchema),
  },
  {
    additionalProperties: true,
    description: 'Festival window + optional comparison window. Accepts dynamic filters beyond the date params.',
  }
);

export type FestivalQueryString = Static<typeof FestivalQueryStringSchema>;

const NullableNumber = Type.Union([Type.Number(), Type.Null()]);

/**
 * Festival balance response. Growth/comparison fields are the event window vs
 * the provided static comparison window (nullable when the comparison base is 0).
 */
export const FestivalBalanceSchema = Type.Object(
  {
    // Ventas (facturado + comprometido)
    sales_total: Type.Number({ description: 'Ventas del evento (facturado + comprometido)' }),
    sales_total_compare: NullableNumber, // null cuando no hay comparativa
    sales_total_growth: NullableNumber, // % vs comparación

    // Margen
    gross_margin: Type.Number({ description: 'Margen bruto (valor absoluto)' }),
    gross_margin_pct: Type.Number({ description: 'Margen bruto %' }),
    gross_margin_pct_compare: NullableNumber,
    gross_margin_pct_growth: NullableNumber,

    // Rappel (nueva columna, aún no disponible → 0 por ahora)
    rappel: Type.Number({ description: 'Rappel (valor absoluto)' }),
    rappel_pct: Type.Number({ description: 'Rappel %' }),

    // Margen + Rappel
    margen_rappel: Type.Number({ description: 'Margen bruto + rappel (valor absoluto)' }),
    margen_rappel_pct: Type.Number({ description: '(Margen bruto + rappel) sobre ventas, %' }),
    margen_rappel_pct_compare: NullableNumber, // null sin comparativa
    margen_rappel_pct_growth: NullableNumber, // % vs comparación

    // Pedidos
    comprometido: Type.Number({ description: 'Valor de pedidos comprometidos (pendientes de facturar)' }),
    pedidos_count: Type.Number({ description: 'Nº de pedidos del evento (facturados + comprometidos, sin solape)' }),
    pedido_promedio: Type.Number({ description: 'Ventas totales del evento / nº de pedidos' }),
    pedido_promedio_compare: NullableNumber, // null sin comparativa o sin pedidos en la ventana comparada

    // Alcance del evento (deduplicados entre facturado y comprometido)
    clientes_unicos: Type.Number({ description: 'Clientes únicos atendidos durante el evento' }),
    productos_unicos: Type.Number({ description: 'Productos únicos vendidos durante el evento' }),
  },
  { $id: 'FestivalBalance', description: 'Métricas del dashboard Festival Virtual' }
);

export type FestivalBalance = Static<typeof FestivalBalanceSchema>;

/** Default dimension the festival listing is grouped by. */
export const FESTIVAL_DEFAULT_GROUP_BY = 'ProveedorComercial';

/**
 * Virtual "Marcas" grouping: two aggregated buckets by ProveedorComercial.
 * - Marcas Exclusivas → ProveedorComercial IN EXCLUSIVE_BRANDS
 * - Marcas Aliadas    → ProveedorComercial NOT IN EXCLUSIVE_BRANDS
 * (Same definition as the Marcas Exclusivas / Aliadas dashboards.)
 */
export const FESTIVAL_BRAND_GROUP = 'brand_group';
export const EXCLUSIVE_BRANDS = ['VERA', 'FORTE'];

/**
 * Date column that carries the ORDER date per metrics table: transactions
 * store it in `order_date` (SIESA "PedidoFecha"), while in pedidos_retenidos
 * the row `date` IS the order date (there is no order_date column).
 * Drives both the window filters and the daily series grouping.
 */
export const FESTIVAL_DATE_FIELDS = {
  transactions: 'order_date',
  pedidos_retenidos: 'date',
} as const;

/**
 * Expand a brand bucket into per-table filter conditions. The commercial
 * provider column is named differently per table (`ProveedorComercial` in
 * transactions, `proveedorComercial` in pedidos_retenidos), so each condition
 * is scoped to its table — otherwise pedidos would either be zeroed (balance)
 * or silently left unfiltered (grouped listing).
 */
export function brandGroupFilters(bucket: 'exclusivas' | 'aliadas'): FilterCondition[] {
  const brandFieldByTable = {
    transactions: 'ProveedorComercial',
    pedidos_retenidos: 'proveedorComercial',
  } as const;

  return Object.entries(brandFieldByTable).flatMap(([table, field]): FilterCondition[] =>
    bucket === 'exclusivas'
      ? [{ field, operator: 'in', value: EXCLUSIVE_BRANDS, table }]
      : EXCLUSIVE_BRANDS.map((b) => ({ field, operator: 'neq', value: b, table }))
  );
}

/**
 * Virtual "Rappel" grouping: split EVENT SALES by whether the transaction
 * generates rappel (rappel > 0) or not. Split is per sale line, not per
 * product — a product sold with and without rappel shows up in both buckets
 * with the corresponding portion. Comprometido has no rappel column, so it is
 * excluded from rappel views (the pedidos-scoped condition below zeroes it).
 */
export const FESTIVAL_RAPPEL_GROUP = 'rappel_group';

export function rappelGroupFilters(bucket: 'con_rappel' | 'sin_rappel'): FilterCondition[] {
  // Filter on rappel_pct, NOT rappel: the metric alias `sum(rappel) AS rappel`
  // shadows the column inside the CTE's WHERE (ClickHouse alias resolution).
  // rappel_pct > 0 ⟺ rappel > 0 (verified: zero discrepancies in data).
  return [
    { field: 'rappel_pct', operator: bucket === 'con_rappel' ? 'gt' : 'eq', value: '0', table: 'transactions' },
    // pedidos_retenidos has no rappel column → the scoped condition cannot be
    // applied and the engine zeroes the table (excludes comprometido).
    { field: 'rappel_pct', operator: 'gt', value: '0', table: 'pedidos_retenidos' },
  ];
}

/**
 * Query parameters for the festival listing: the festival/comparison windows
 * plus the dimension to group by (defaults to commercial provider).
 */
export const FestivalListQueryStringSchema = Type.Object(
  {
    startDate: DateStringSchema,
    endDate: DateStringSchema,
    compareStartDate: Type.Optional(DateStringSchema),
    compareEndDate: Type.Optional(DateStringSchema),
    groupBy: Type.Optional(Type.String({ description: 'Dimension to group rows by (e.g. ProveedorComercial)' })),
  },
  {
    additionalProperties: true,
    description: 'Festival listing grouped by an arbitrary dimension.',
  }
);

export type FestivalListQueryString = Static<typeof FestivalListQueryStringSchema>;

/**
 * One row of the festival listing (grouped by any dimension). Same metric
 * labels as the header cards: ventas del evento, margen %, rappel %, margen + rappel %.
 */
export const FestivalListRowSchema = Type.Object(
  {
    id: Type.String({ description: 'Raw value of the grouped dimension (for drill-down filtering)' }),
    name: Type.String({ description: 'Display value of the grouped dimension' }),
    sales_total: Type.Number({ description: 'Ventas del evento (facturado + comprometido)' }),
    gross_margin_pct: Type.Number({ description: 'Margen bruto %' }),
    rappel_pct: Type.Number({ description: 'Rappel %' }),
    margen_rappel_pct: Type.Number({ description: '(Margen + rappel) sobre ventas, %' }),
    comprometido: Type.Number({ description: 'Valor de pedidos comprometidos (pendientes de facturar)' }),
    pedido_promedio: Type.Number({ description: 'Ventas totales / nº de pedidos del grupo' }),
  },
  { $id: 'FestivalListRow' }
);

export type FestivalListRow = Static<typeof FestivalListRowSchema>;

export const FestivalListSchema = Type.Array(FestivalListRowSchema);

/** One day of the festival daily sales series. */
export const FestivalDailyPointSchema = Type.Object(
  {
    period: Type.String({ description: 'Día (yyyy-MM-dd)' }),
    sales_total: Type.Number({ description: 'Ventas del día (facturado + comprometido)' }),
  },
  { $id: 'FestivalDailyPoint' }
);

export type FestivalDailyPoint = Static<typeof FestivalDailyPointSchema>;

export const FestivalDailySchema = Type.Array(FestivalDailyPointSchema);
