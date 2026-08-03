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
 * Festival budget table: one row per regional × seller per edition, keyed by
 * `periodo` (yyyyMM of the event month, e.g. 202608) with `date` at month
 * start — outside the event window, so it is selected via periodo, never via
 * the window date filters. Only IdRegional/seller_id dimensions exist (no
 * channel/product/customer/brand).
 */
export const FESTIVAL_PPTO_TABLE = 'ppto_festival';

/** Budget-table filter selecting the edition that contains `startDate`. */
export function pptoPeriodoFilter(startDate: string): FilterCondition {
  return {
    field: 'periodo',
    operator: 'eq',
    value: startDate.slice(0, 7).replace('-', ''),
    table: FESTIVAL_PPTO_TABLE,
  };
}

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
  // Event budget (dyna_ppto_festival): one row per regional × seller per
  // edition, selected via `periodo`. The table only has IdRegional/seller_id
  // dimensions — any other filter or grouping zeroes it, and the frontend
  // hides the compliance metric when budget comes back 0.
  { table: FESTIVAL_PPTO_TABLE, field: 'valor', aggregation: 'sum', alias: 'budget' },
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
    sales_total_growth: NullableNumber, // % vs comparación (evento completo)
    // Crecimiento "a mismo día": días cerrados vs mismos días del evento anterior.
    sales_total_growth_to_date: NullableNumber, // null hasta cerrar el día 1 o sin comparativa
    // Acumulado del evento anterior hasta el día en curso (crece cada día).
    sales_total_compare_to_date: NullableNumber,
    to_date_days: Type.Number({ description: 'Días cerrados incluidos en el crecimiento a mismo día' }),
    current_day: Type.Number({ description: 'Día del evento en curso (0 antes de empezar)' }),
    event_days: Type.Number({ description: 'Duración del evento en días' }),

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
    margen_rappel_pct_growth: NullableNumber, // % vs comparación (evento completo)
    margen_rappel_pct_growth_to_date: NullableNumber, // "a mismo día" (días cerrados)
    margen_rappel_pct_compare_to_date: NullableNumber, // margen del anterior hasta el día en curso

    // Pedidos
    comprometido: Type.Number({ description: 'Valor de pedidos comprometidos (pendientes de facturar)' }),
    pedidos_count: Type.Number({ description: 'Nº de pedidos del evento (facturados + comprometidos, sin solape)' }),
    pedido_promedio: Type.Number({ description: 'Ventas totales del evento / nº de pedidos' }),
    pedido_promedio_compare: NullableNumber, // null sin comparativa o sin pedidos en la ventana comparada

    // Alcance del evento (deduplicados entre facturado y comprometido)
    clientes_unicos: Type.Number({ description: 'Clientes únicos atendidos durante el evento' }),
    productos_unicos: Type.Number({ description: 'Productos únicos vendidos durante el evento' }),
    clientes_sin_compra: Type.Number({
      description: 'Clientes activos con compra en el año del evento que no han comprado durante el festival',
    }),

    // Presupuesto del festival. Null cuando los filtros activos no son
    // aplicables al presupuesto (producto, cliente, marca, promoción…).
    presupuesto: NullableNumber, // presupuesto completo del evento
    presupuesto_meta: NullableNumber, // meta prorrateada al día en curso (completa antes/después del evento)
    cumplimiento_ppto: NullableNumber, // ventas totales / meta, %
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
 * Universe for "clientes sin compra": active customers (customer_active) with
 * invoiced sales in the event's year. Scoped to transactions — the retained
 * orders table has no activity/year columns. The festival buyers subtracted
 * from this universe come from the same sources as `clientes_unicos`.
 */
export function activeCustomerUniverseFilters(startDate: string): FilterCondition[] {
  return [
    { field: 'year', operator: 'eq', value: startDate.slice(0, 4), table: 'transactions' },
    { field: 'customer_active', operator: 'eq', value: 'true', table: 'transactions' },
  ];
}

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

  const brandConditions = Object.entries(brandFieldByTable).flatMap(([table, field]): FilterCondition[] =>
    bucket === 'exclusivas'
      ? [{ field, operator: 'in', value: EXCLUSIVE_BRANDS, table }]
      : EXCLUSIVE_BRANDS.map((b) => ({ field, operator: 'neq', value: b, table }))
  );
  return [
    ...brandConditions,
    // The budget has no brand column → this scoped condition cannot be applied
    // and the engine zeroes the table (budget is not splittable by brand).
    { field: 'ProveedorComercial', operator: 'in', value: EXCLUSIVE_BRANDS, table: FESTIVAL_PPTO_TABLE },
  ];
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
    // Neither pedidos_retenidos nor the budget have a rappel column → these
    // scoped conditions cannot be applied and the engine zeroes both tables
    // (comprometido and presupuesto are excluded from rappel views).
    { field: 'rappel_pct', operator: 'gt', value: '0', table: 'pedidos_retenidos' },
    { field: 'rappel_pct', operator: 'gt', value: '0', table: FESTIVAL_PPTO_TABLE },
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
 * Query parameters for the festival listing Excel export: same contract as
 * /festival/list plus presentation labels. The labels are already reserved in
 * the dynamic filter parser, so they never leak into the filters.
 */
export const FestivalListExportQueryStringSchema = Type.Composite(
  [
    FestivalListQueryStringSchema,
    Type.Object({
      dimensionLabel: Type.Optional(Type.String({ description: 'Header of the dimension column' })),
      reportTitle: Type.Optional(Type.String({ description: 'Report title shown at the top of the file' })),
      periodLabel: Type.Optional(Type.String({ description: 'Human-readable event window' })),
      generatedLabel: Type.Optional(Type.String({ description: 'Date the export was generated' })),
      filename: Type.Optional(Type.String({ description: 'Download filename (without extension)' })),
    }),
  ],
  {
    additionalProperties: true,
    description: 'Festival listing export: listing params + presentation labels.',
  }
);

export type FestivalListExportQueryString = Static<typeof FestivalListExportQueryStringSchema>;

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
    // Alcance del grupo (deduplicados entre facturado y comprometido)
    clientes_unicos: Type.Number({ description: 'Numérica: clientes únicos del grupo durante el evento' }),
    productos_unicos: Type.Number({ description: 'Items: productos únicos del grupo durante el evento' }),
    clientes_sin_compra: Type.Number({
      description: 'Clientes activos con compra del grupo en el año del evento y sin compra del grupo durante el festival',
    }),
    presupuesto: NullableNumber, // presupuesto del evento para el grupo; null si no aplica
    cumplimiento_ppto: NullableNumber, // ventas / meta prorrateada, %
  },
  { $id: 'FestivalListRow' }
);

export type FestivalListRow = Static<typeof FestivalListRowSchema>;

export const FestivalListSchema = Type.Array(FestivalListRowSchema);

/**
 * One client of the "clientes sin compra" detail listing: an active customer
 * with invoiced sales in the event's year and no purchase during the festival.
 * The seller is the one on the customer's latest invoiced sale of the year.
 */
export const FestivalSinCompraRowSchema = Type.Object(
  {
    customer_id: Type.String(),
    customer_name: Type.String(),
    seller_id: Type.String(),
    seller_name: Type.String(),
  },
  { $id: 'FestivalSinCompraRow' }
);

export type FestivalSinCompraRow = Static<typeof FestivalSinCompraRowSchema>;

export const FestivalSinCompraSchema = Type.Array(FestivalSinCompraRowSchema);

/**
 * Query parameters for the "clientes sin compra" Excel export: same contract
 * as /festival plus presentation labels (reserved in the filter parser).
 */
export const FestivalSinCompraExportQueryStringSchema = Type.Composite(
  [
    FestivalQueryStringSchema,
    Type.Object({
      reportTitle: Type.Optional(Type.String()),
      periodLabel: Type.Optional(Type.String()),
      generatedLabel: Type.Optional(Type.String()),
      filename: Type.Optional(Type.String()),
    }),
  ],
  {
    additionalProperties: true,
    description: 'Clientes sin compra export: festival params + presentation labels.',
  }
);

export type FestivalSinCompraExportQueryString = Static<typeof FestivalSinCompraExportQueryStringSchema>;

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
