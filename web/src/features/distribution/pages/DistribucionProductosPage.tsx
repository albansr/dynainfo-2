import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';
import { DistribucionBreadcrumbs } from '../components/DistribucionBreadcrumbs';

/**
 * Distribution · Productos — table-only listing grouped by product id
 * (displaying product name), filtered to the distribution channel.
 * Rows drill into the entity detail.
 */
export function DistribucionProductosPage() {
  return (
    <AnalyticsPage
      title="Productos"
      groupBy="product_id"
      totalsLabel="TOTAL PRODUCTOS:"
      filters={{ channel: 'DISTRIBUCION' }}
      hideMetrics
      showIdInName
      hideBudgetColumns
      pageSize={100}
      showSearch
      enableFilters
      filterContext={{ channel: 'DISTRIBUCION' }}
      drillToDetail
      breadcrumbs={<DistribucionBreadcrumbs listLabel="Productos" listPath="/distribucion/productos" />}
    />
  );
}
