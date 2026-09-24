import type { GroupByDimension } from '@/core/api/hooks/useList';
import { appendFilterParams, type FilterMap } from '@/core/api/downloadExcel';
import { DRILL_TARGET } from '@/core/config/drillTarget';

export { DRILL_TARGET };

export interface DimOption {
  key: GroupByDimension;
  label: string;
}

export interface DimCategory {
  id: 'cliente' | 'producto' | 'vendedor';
  label: string;
  dims: DimOption[];
}

/**
 * Curated groupable dimensions organized by category, for the detail
 * drill-down breakdown selector.
 */
export const DIM_CATEGORIES: DimCategory[] = [
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
      { key: 'IdRegional', label: 'Regional' },
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

/** Entity dimension of each category (also the qube6 segment chart entity keys). */
export const CATEGORY_ENTITY: Record<DimCategory['id'], GroupByDimension> = {
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
  return getBreakdownCategories(filters).map((c) => CATEGORY_ENTITY[c.id]);
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
