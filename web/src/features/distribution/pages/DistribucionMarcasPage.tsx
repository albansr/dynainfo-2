import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';
import { DistribucionBreadcrumbs } from '../components/DistribucionBreadcrumbs';

/**
 * Distribution · Marcas Exclusivas — same as the Manager brands page but
 * scoped to the distribution channel, with clickable drill-down rows.
 */
export function DistribucionMarcasPage() {
  return (
    <AnalyticsPage
      title="Marcas Exclusivas"
      groupBy="ProveedorComercial"
      totalsLabel="TOTAL MARCAS:"
      filters={{ channel: 'DISTRIBUCION', ProveedorComercial: ['VERA', 'FORTE'] }}
      showSearch
      drillToDetail
      breadcrumbs={<DistribucionBreadcrumbs listLabel="Marcas Exclusivas" listPath="/distribucion/marcas" />}
    />
  );
}
