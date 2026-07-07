import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';
import { DistribucionBreadcrumbs } from '../components/DistribucionBreadcrumbs';

/**
 * Distribution · Vendedores — table-only listing grouped by seller,
 * filtered to the distribution channel. Rows drill into the entity detail.
 */
export function DistribucionComercialesPage() {
  return (
    <AnalyticsPage
      title="Vendedores"
      groupBy="seller_id"
      totalsLabel="TOTAL VENDEDORES:"
      filters={{ channel: 'DISTRIBUCION' }}
      dimensionLabel="VENDEDORES"
      hideMetrics
      pageSize={100}
      showSearch
      enableFilters
      filterContext={{ channel: 'DISTRIBUCION' }}
      drillToDetail
      breadcrumbs={<DistribucionBreadcrumbs listLabel="Vendedores" listPath="/distribucion/comerciales" />}
    />
  );
}
