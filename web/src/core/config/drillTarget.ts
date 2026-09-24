/**
 * Canonical drill-target chain (single source of truth).
 *
 * When a row grouped by dimension X is clicked, the detail opens grouped by
 * `DRILL_TARGET[X]` (the next dimension in the chain). Shared by the Festival
 * Virtual page, the generic detail explorer (`/distribucion/detalle`) and the
 * `/dashboard` analysis table, so drilling behaves the same everywhere.
 *
 * Fixed concept chains, regardless of where you enter them:
 *   Marcas (Exclusivas/Aliadas) → Proveedor → Producto → Cliente
 *   Regional → Vendedor → Proveedor → …
 *   Cliente → Proveedor → …
 *   Categoría → Marca → Producto
 * Dimensions without an entry fall back to `DRILL_TARGET_FALLBACK`.
 */
export const DRILL_TARGET: Record<string, string> = {
  // Virtual grouping buckets
  brand_group: 'ProveedorComercial',
  rappel_group: 'product_id',
  segmentacion_ventas_festival: 'seller_id',
  // Entities & cross-overs
  IdRegional: 'seller_id',
  seller_id: 'ProveedorComercial',
  customer_id: 'ProveedorComercial',
  ProveedorComercial: 'product_id',
  Categoria: 'Marca',
  Marca: 'product_id',
  product_id: 'customer_id',
};

/** Fallback grouping when a dimension has no explicit drill target. */
export const DRILL_TARGET_FALLBACK = 'customer_id';
