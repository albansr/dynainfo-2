import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

/**
 * Brands Analytics Page
 *
 * Shows sales, budget, and margin analytics grouped by product/brand.
 */
export function BrandsPage() {
  return (
    <AnalyticsPage
      title="Proveedor Comercial / Marcas"
      groupBy="product"
      totalsLabel="TOTAL MARCAS:"
    />
  );
}
