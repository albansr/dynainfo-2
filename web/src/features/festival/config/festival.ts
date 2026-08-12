/**
 * Festival Virtual configuration.
 *
 * Provisional: two fixed editions selectable from the dashboard. Windows are
 * concrete dates (no presets); the festival filters by ORDER date (order_date).
 */
export interface FestivalDef {
  id: 'fv1' | 'fv2';
  name: string;
  /** Event window. */
  startDate: Date;
  endDate: Date;
  /** Optional static comparison window. Absent → no comparison shown. */
  compareStartDate?: Date;
  compareEndDate?: Date;
}

export const FESTIVALS: FestivalDef[] = [
  {
    id: 'fv2',
    name: 'Festival Virtual 2',
    startDate: new Date(2026, 7, 12), // 12 ago 2026
    endDate: new Date(2026, 7, 16), // 16 ago 2026
    compareStartDate: new Date(2026, 2, 11), // comparativa: festival anterior (marzo)
    compareEndDate: new Date(2026, 2, 16),
  },
  {
    id: 'fv1',
    name: 'Festival Virtual 1',
    startDate: new Date(2026, 2, 11), // 11 mar 2026
    endDate: new Date(2026, 2, 16), // 16 mar 2026
    // sin comparativa
  },
];

export const DEFAULT_FESTIVAL_ID: FestivalDef['id'] = 'fv2';

/** Resolve a festival by id, falling back to the default edition. */
export function getFestival(id: string | null | undefined): FestivalDef {
  return FESTIVALS.find((f) => f.id === id) ?? FESTIVALS.find((f) => f.id === DEFAULT_FESTIVAL_ID)!;
}

/** Virtual "Marcas" grouping key (resolved server-side into Exclusivas/Aliadas). */
export const FESTIVAL_BRAND_GROUP = 'brand_group';

/** Virtual "Promoción" grouping key (server-side split: productos con/sin promoción, por rappel). */
export const FESTIVAL_RAPPEL_GROUP = 'rappel_group';

/** Dimensions offered by the festival listing selector. */
export const FESTIVAL_DIMENSIONS: { key: string; label: string }[] = [
  { key: FESTIVAL_BRAND_GROUP, label: 'Marcas' },
  { key: FESTIVAL_RAPPEL_GROUP, label: 'Promoción' },
  { key: 'ProveedorComercial', label: 'Proveedores' },
  { key: 'Categoria', label: 'Categoría' },
  { key: 'Marca', label: 'Marca' },
  { key: 'segmentacion_ventas_festival', label: 'Canales' },
  { key: 'IdRegional', label: 'Regionales' },
  { key: 'seller_id', label: 'Vendedores' },
  { key: 'product_id', label: 'Productos' },
  { key: 'customer_id', label: 'Clientes' },
];

/** First-column (row) label per festival dimension. */
export const FESTIVAL_DIM_LABEL: Record<string, string> = {
  [FESTIVAL_BRAND_GROUP]: 'Marca',
  [FESTIVAL_RAPPEL_GROUP]: 'Promoción',
  ProveedorComercial: 'Proveedor',
  Categoria: 'Categoría',
  Marca: 'Marca',
  segmentacion_ventas_festival: 'Canal',
  IdRegional: 'Regional',
  seller_id: 'Vendedor',
  product_id: 'Producto',
  customer_id: 'Cliente',
};

/**
 * Dimension a row drills into when clicked. Festival analysis follows fixed
 * concept chains, regardless of where you enter them:
 *   Marcas (Exclusivas/Aliadas) → Proveedor → Producto
 *   Regional → Vendedor ────────↗
 *   Canal → Vendedor ───────────↗
 *   Cliente ────────────────────↗
 *   Categoría → Marca → Producto
 * The virtual "Promoción" buckets drill straight into products, and a product
 * still crosses over to its customers.
 */
export const FESTIVAL_DRILL_TARGET: Record<string, string> = {
  [FESTIVAL_BRAND_GROUP]: 'ProveedorComercial',
  [FESTIVAL_RAPPEL_GROUP]: 'product_id',
  segmentacion_ventas_festival: 'seller_id',
  IdRegional: 'seller_id',
  seller_id: 'ProveedorComercial',
  customer_id: 'ProveedorComercial',
  ProveedorComercial: 'product_id',
  Categoria: 'Marca',
  Marca: 'product_id',
  product_id: 'customer_id',
};

/** Default listing dimension. */
export const FESTIVAL_DEFAULT_GROUP_BY = FESTIVAL_BRAND_GROUP;
