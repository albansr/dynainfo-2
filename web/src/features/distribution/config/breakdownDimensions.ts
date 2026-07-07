import type { GroupByDimension } from '@/core/api/hooks/useList';

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

/**
 * Dimension shown after drilling into a value of `dim`.
 * Rule "by category": product attributes → products, customer attributes →
 * customers; entities cross over.
 */
export const DRILL_TARGET: Record<string, GroupByDimension> = {
  // Cliente attributes → break down by customer
  SegmentacionCliente: 'customer_id',
  ClasifRiesgo: 'customer_id',
  customer_city: 'customer_id',
  customer_department: 'customer_id',
  customer_country: 'customer_id',
  IdRegional: 'customer_id',
  // Producto attributes → break down by product
  Marca: 'product_id',
  Categoria: 'product_id',
  SubCategoria: 'product_id',
  FamiliaProducto: 'product_id',
  Linea: 'product_id',
  SegmentacionProducto: 'product_id',
  ProveedorComercial: 'product_id',
  // Entities cross over
  customer_id: 'product_id',
  product_id: 'customer_id',
  seller_id: 'product_id',
};

export const DETAIL_PATH = '/distribucion/detalle';

/**
 * URL for drilling into `dim = value` (from a list or a breakdown row).
 * Seeds the distribution channel + the clicked filter + the next breakdown dim.
 */
export function buildDetailUrl(dim: string, value: string, name: string): string {
  const p = new URLSearchParams();
  p.set('channel', 'DISTRIBUCION');
  p.set(dim, value);
  p.set('g', DRILL_TARGET[dim] ?? 'customer_id');
  p.set('trail', name);
  return `${DETAIL_PATH}?${p.toString()}`;
}

/** Breakdown default given the current accumulated filters (target of the last drilled dim). */
export function getBreakdownDefault(filters: Record<string, string>): GroupByDimension {
  const drilledDims = Object.keys(filters).filter((k) => k !== 'channel' && k in DRILL_TARGET);
  const last = drilledDims[drilledDims.length - 1];
  return (last && DRILL_TARGET[last]) || 'customer_id';
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
export function getBreakdownCategories(filters: Record<string, string>): DimCategory[] {
  const filteredKeys = new Set(Object.keys(filters));
  const hiddenCategories = new Set(
    ENTITY_DIMS.filter((d) => filteredKeys.has(d)).map((d) => DIM_CATEGORY[d])
  );
  return DIM_CATEGORIES
    .filter((c) => !hiddenCategories.has(c.id))
    .map((c) => ({ ...c, dims: c.dims.filter((d) => !filteredKeys.has(d.key)) }))
    .filter((c) => c.dims.length > 0);
}
