import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

/**
 * Brands Analytics Page
 *
 * Shows sales, budget, and margin analytics grouped by product/brand.
 */
export function BrandsPage() {
  return (
    <AnalyticsPage
      title="Proveedor Comercial / Marcas Propias"
      groupBy="ProveedorComercial"
      totalsLabel="TOTAL MARCAS:"
      filters={{ ProveedorComercial: ['VERA', 'FORTE'] }}
    />
  );
}
