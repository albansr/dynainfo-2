import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function BrandsExternalPage() {
  return (
    <AnalyticsPage
      title="Proveedor Comercial / Marcas Externas"
      groupBy="ProveedorComercial"
      totalsLabel="TOTAL MARCAS:"
      filters={{ 'ProveedorComercial[neq][]': ['VERA', 'FORTE'] }}
    />
  );
}
