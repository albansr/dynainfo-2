import type { GroupByDimension } from '@/core/api/hooks/useList';

/**
 * Maps groupBy dimension IDs to semantic Spanish labels
 * Used for dynamic first column headers in analytics tables
 */
export const DIMENSION_LABELS: Record<GroupByDimension, string> = {
  IdRegional: 'REGIONAL',
  customer_country: 'PAÍS',
  customer_name: 'CLIENTE',
  SegmentacionProducto: 'Segmentación Producto',
  SegmentacionCliente: 'SEGMENTO CLIENTE',
  Marca: 'MARCA',
  ProveedorComercial: 'PROVEEDOR',
  seller_id: 'VENDEDOR',
  customer_id: 'ID CLIENTE',
  product_id: 'ID PRODUCTO',
  month: 'MES',
  quarter: 'TRIMESTRE',
  year: 'AÑO',
};

/**
 * Get the semantic label for a dimension
 * @param dimension - The groupBy dimension ID
 * @returns The human-readable Spanish label
 */
export function getDimensionLabel(dimension: GroupByDimension): string {
  return DIMENSION_LABELS[dimension] || dimension;
}
