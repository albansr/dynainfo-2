import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function BrandsExternalPage() {
  return (
    <AnalyticsPage
      title="Proveedor Comercial / Marcas Externas"
      groupBy="brand"
      totalsLabel="TOTAL MARCAS:"
      filters={{ brand_type: 'external' }}
    />
  );
}
