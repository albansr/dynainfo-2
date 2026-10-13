import type { GroupByDimension } from '@/core/api/hooks/useList';
import { appendFilterParams, type FilterMap } from '@/core/api/downloadExcel';
import { DRILL_TARGET } from '@/core/config/drillTarget';

export { DRILL_TARGET };

export interface DimOption {
  key: GroupByDimension;
  label: string;
}

export interface DimCategory {
  id: 'general' | 'cliente' | 'producto' | 'vendedor';
  /** Section heading in the selector; empty string renders an untitled section. */
  label: string;
  dims: DimOption[];
}

/**
 * Curated groupable dimensions organized by category, for the detail
 * drill-down breakdown selector.
 */
export const DIM_CATEGORIES: DimCategory[] = [
  {
    // Headline cross-cutting groupings, shown first without a section heading.
    id: 'general',
    label: '',
    dims: [
      { key: 'channel', label: 'Canal' },
      // Sales channel of each invoice (Vendedores / Tienda Virtual / Call Center),
      // the same field Festival Virtual groups by. Only sales and orders carry it.
      { key: 'segmentacion_ventas_festival', label: 'Canal de venta' },
      { key: 'IdRegional', label: 'Regional' },
      { key: 'brand_group', label: 'Marcas (Aliadas y Exclusivas)' },
    ],
  },
  {
    id: 'cliente',
    label: 'Cliente',
    dims: [
      { key: 'customer_id', label: 'Cliente' },
      { key: 'SegmentacionCliente', label: 'Segmentación Cliente' },
      { key: 'ClasifRiesgo', label: 'Clasif. Riesgo' },
      { key: 'customer_city', label: 'Ciudad' },
      { key: 'customer_department', label: 'Departamento' },
      { key: 'customer_country', label: 'País' },
    ],
  },
  {
    id: 'producto',
    label: 'Producto',
    dims: [
      { key: 'product_id', label: 'Producto' },
      { key: 'Marca', label: 'Marca' },
      { key: 'Categoria', label: 'Categoría' },
      { key: 'SubCategoria', label: 'Subcategoría' },
      { key: 'FamiliaProducto', label: 'Familia' },
      { key: 'Linea', label: 'Línea' },
      { key: 'SegmentacionProducto', label: 'Segmentación Producto' },
      { key: 'ProveedorComercial', label: 'Proveedor' },
    ],
  },
  {
    id: 'vendedor',
    label: 'Vendedor',
    dims: [{ key: 'seller_id', label: 'Vendedor' }],
  },
];

/** Entity dimensions (the "id" of each category). */
export const ENTITY_DIMS: GroupByDimension[] = ['customer_id', 'product_id', 'seller_id'];

/**
 * Entity dimension of each category (also the qube6 segment chart entity keys).
 * Categories without a drillable entity (e.g. Canal) are omitted.
 */
export const CATEGORY_ENTITY: Partial<Record<DimCategory['id'], GroupByDimension>> = {
  cliente: 'customer_id',
  producto: 'product_id',
  vendedor: 'seller_id',
};

/** category id for each dimension (used to hide a whole category when its entity is filtered). */
export const DIM_CATEGORY: Record<string, DimCategory['id']> = Object.fromEntries(
  DIM_CATEGORIES.flatMap((c) => c.dims.map((d) => [d.key, c.id]))
) as Record<string, DimCategory['id']>;

/** Flat label lookup. */
export const DIM_LABEL: Record<string, string> = Object.fromEntries(
  DIM_CATEGORIES.flatMap((c) => c.dims.map((d) => [d.key, d.label]))
);

/**
 * Dimensions that can group a listing but cannot be faceted as a filter — they
 * are virtual buckets with no real column to enumerate values from. Excluded
 * from the "Añadir filtro" selector (they only make sense in "Agrupar por").
 */
export const NON_FACETABLE_DIMS = new Set<GroupByDimension>(['brand_group']);

export const DETAIL_PATH = '/distribucion/detalle';

/**
 * URL for drilling into `dim = value` (from a list or a breakdown row).
 * Seeds the base context (channel or other page filters) + the clicked filter +
 * the next breakdown dim. When no seed is given, defaults to the distribution
 * channel (backward-compatible with the distribution pages).
 */
export function buildDetailUrl(
  dim: string,
  value: string,
  name: string,
  seed?: FilterMap,
): string {
  const p = new URLSearchParams();
  appendFilterParams(p, seed ?? { channel: 'DISTRIBUCION' });
  p.set(dim, value);
  p.set('g', DRILL_TARGET[dim] ?? 'customer_id');
  p.set('trail', name);
  return `${DETAIL_PATH}?${p.toString()}`;
}

/** Breakdown default given the current accumulated filters (target of the last drilled dim). */
export function getBreakdownDefault(filters: Record<string, string>): GroupByDimension {
  const drilledDims = Object.keys(filters).filter((k) => k !== 'channel' && k in DRILL_TARGET);
  const last = drilledDims[drilledDims.length - 1];
  return ((last && DRILL_TARGET[last]) || 'customer_id') as GroupByDimension;
}

/**
 * Entity keys for the qube6 segment chart, matching the visible breakdown
 * categories (so the chart hides the "own" entity like the breakdown does).
 */
export function getSegmentEntityOptions(filters: Record<string, string>): string[] {
  return getBreakdownCategories(filters)
    .map((c) => CATEGORY_ENTITY[c.id])
    .filter((entity): entity is GroupByDimension => Boolean(entity));
}

/**
 * Category-grouped options for the selector, excluding dimensions already
 * present in `filters` and hiding a whole category when its entity is filtered.
 */
export function getBreakdownCategories(filters: FilterMap): DimCategory[] {
  const filteredKeys = new Set(Object.keys(filters));
  const hiddenCategories = new Set(
    ENTITY_DIMS.filter((d) => filteredKeys.has(d)).map((d) => DIM_CATEGORY[d])
  );
  return DIM_CATEGORIES
    .filter((c) => !hiddenCategories.has(c.id))
    .map((c) => ({ ...c, dims: c.dims.filter((d) => !filteredKeys.has(d.key)) }))
    .filter((c) => c.dims.length > 0);
}

/**
 * Dimensions the budget (dyna_budget) is actually broken down by: seller,
 * regional, provider and channel (its customer/product/category columns are
 * empty), plus the provider buckets and time groupings.
 */
const BUDGET_DIMENSIONS: ReadonlySet<string> = new Set([
  'seller_id', 'IdRegional', 'ProveedorComercial', 'channel', 'brand_group', 'month', 'quarter', 'year',
]);

/** Dimensions RET. CARTERA (dyna_cartera) is broken down by: the budget's plus customer and product. */
const CARTERA_DIMENSIONS: ReadonlySet<string> = new Set([
  ...BUDGET_DIMENSIONS, 'customer_id', 'customer_name', 'product_id',
]);

/** The grouping and every filter in play can be split by the table's dimensions. */
const splitsBy = (dimensions: ReadonlySet<string>, groupBy: GroupByDimension, filters: FilterMap): boolean =>
  dimensions.has(groupBy) && Object.keys(filters).every((dim) => dimensions.has(dim));

/**
 * Whether a listing shows the budget columns (PPTO, cumplimiento, margen ppto):
 * only when the grouping and every filter can split the budget — elsewhere they
 * always read 0, so the columns are hidden.
 */
export function listingShowsBudget(groupBy: GroupByDimension, filters: FilterMap = {}): boolean {
  return splitsBy(BUDGET_DIMENSIONS, groupBy, filters);
}

/** Whether a listing shows RET. CARTERA (same rule, over dyna_cartera's dimensions). */
export function listingShowsCartera(groupBy: GroupByDimension, filters: FilterMap = {}): boolean {
  return splitsBy(CARTERA_DIMENSIONS, groupBy, filters);
}
