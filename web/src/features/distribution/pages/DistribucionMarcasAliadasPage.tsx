import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';
import { DistribucionBreadcrumbs } from '../components/DistribucionBreadcrumbs';

/**
 * Distribution · Marcas Aliadas — same as the Manager external brands page but
 * scoped to the distribution channel, with clickable drill-down rows.
 */
export function DistribucionMarcasAliadasPage() {
  return (
    <AnalyticsPage
      title="Marcas Aliadas"
      groupBy="ProveedorComercial"
      totalsLabel="TOTAL MARCAS:"
      filters={{ channel: 'DISTRIBUCION', 'ProveedorComercial[neq][]': ['VERA', 'FORTE'] }}
      showSearch
      drillToDetail
      breadcrumbs={<DistribucionBreadcrumbs listLabel="Marcas Aliadas" listPath="/distribucion/marcas-aliadas" />}
    />
  );
}
