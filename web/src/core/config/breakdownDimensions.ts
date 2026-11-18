import type { GroupByDimension } from '@/core/api/hooks/useList';
import { appendFilterParams, type FilterMap } from '@/core/api/downloadExcel';
import { DRILL_TARGET, DRILL_TARGET_FALLBACK } from '@/core/config/drillTarget';

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

/** Detail params that carry page state, not data filters. */
const DETAIL_PAGE_KEYS = new Set(['v', 'g', 'trail']);

/** A URL filter entry: [dimension, value]. Repeated keys are multi-value filters. */
export type FilterEntry = [string, string];

/**
 * A drill path on the detail page. `seed` are the filters of the analysis view
 * the drill started from; `steps` hold one entry per drilled row, aligned with
 * the breadcrumb labels in `trail`.
 */
export interface DetailPath {
  /** Analysis view the drill started from; null on links made before it was recorded. */
  viewId: string | null;
  seed: FilterEntry[];
  steps: FilterEntry[];
  trail: string[];
}

export interface DetailContext extends DetailPath {
  /** Every data filter; repeated params stay arrays (e.g. Exportaciones + Cadenas). */
  filters: FilterMap;
  groupBy: GroupByDimension;
}

/** Group URL entries into a filter map, keeping repeated keys as arrays. */
function toFilterMap(entries: FilterEntry[]): FilterMap {
  const map: Record<string, string | string[]> = {};
  for (const [key, value] of entries) {
    const prev = map[key];
    map[key] = prev === undefined ? value : [...(Array.isArray(prev) ? prev : [prev]), value];
  }
  return map;
}

/**
 * Grouping shown after drilling into `dim`: its drill target, unless that is
 * already a filter (e.g. Cliente → Proveedor after drilling a provider), where
 * grouping by it again would show one row and clicking it would desync the
 * breadcrumbs. Then the first dimension still available.
 */
export function nextGroupBy(dim: string, filters: FilterMap): GroupByDimension {
  const target = DRILL_TARGET[dim] ?? DRILL_TARGET_FALLBACK;
  if (!(target in filters)) return target as GroupByDimension;
  return getBreakdownCategories(filters)[0]?.dims[0]?.key ?? DRILL_TARGET_FALLBACK;
}

/**
 * URL of the detail page for a drill path. Each step replaces any filter on its
 * dimension and goes last, so the steps are always the trailing entries.
 */
export function detailUrl({ viewId, seed, steps, trail }: DetailPath): string {
  const p = new URLSearchParams();
  if (viewId) p.set('v', viewId);
  seed.forEach(([k, v]) => p.append(k, v));
  steps.forEach(([k, v]) => {
    p.delete(k);
    p.append(k, v);
  });
  const lastDim = steps[steps.length - 1]?.[0];
  const filters = toFilterMap([...p.entries()].filter(([k]) => !DETAIL_PAGE_KEYS.has(k)));
  p.set('g', lastDim ? nextGroupBy(lastDim, filters) : DRILL_TARGET_FALLBACK);
  p.set('trail', trail.join('|'));
  return `${DETAIL_PATH}?${p.toString()}`;
}

/** URL for drilling into `dim = value` from an analysis view's table. */
export function buildDetailUrl(viewId: string, seed: FilterMap, dim: string, value: string, name: string): string {
  const p = new URLSearchParams();
  appendFilterParams(p, seed);
  return detailUrl({ viewId, seed: [...p.entries()], steps: [[dim, value]], trail: [name] });
}

/** Read the detail page state from its query string (the single source of truth). */
export function parseDetailParams(search: string): DetailContext {
  const p = new URLSearchParams(search);
  const trail = (p.get('trail') ?? '').split('|').filter(Boolean);
  const entries = [...p.entries()].filter(([k]) => !DETAIL_PAGE_KEYS.has(k));
  const split = Math.max(0, entries.length - trail.length);
  const steps = entries.slice(split);
  const filters = toFilterMap(entries);
  const lastDim = steps[steps.length - 1]?.[0];
  return {
    viewId: p.get('v'),
    seed: entries.slice(0, split),
    steps,
    trail,
    filters,
    groupBy: (p.get('g') as GroupByDimension | null) ?? (lastDim ? nextGroupBy(lastDim, filters) : DRILL_TARGET_FALLBACK),
  };
}

/**
 * Entity keys for the qube6 segment chart, matching the visible breakdown
 * categories (so the chart hides the "own" entity like the breakdown does).
 */
export function getSegmentEntityOptions(filters: FilterMap): string[] {
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

/** Dimension of a filter key, without its operator suffix (`ProveedorComercial[neq][]` → `ProveedorComercial`). */
const filterDimension = (key: string): string => key.replace(/\[.*$/, '');

/** The grouping and every filter in play can be split by the table's dimensions. */
const splitsBy = (dimensions: ReadonlySet<string>, groupBy: GroupByDimension, filters: FilterMap): boolean =>
  dimensions.has(groupBy) && Object.keys(filters).every((key) => dimensions.has(filterDimension(key)));

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
