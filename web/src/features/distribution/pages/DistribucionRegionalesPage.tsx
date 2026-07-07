import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';
import { DistribucionBreadcrumbs } from '../components/DistribucionBreadcrumbs';

/**
 * Distribution · Regionales — table-only listing grouped by regional,
 * filtered to the distribution channel. Rows drill into the entity detail.
 */
export function DistribucionRegionalesPage() {
  return (
    <AnalyticsPage
      title="Regionales"
      groupBy="IdRegional"
      totalsLabel="TOTAL REGIONALES:"
      filters={{ channel: 'DISTRIBUCION' }}
      hideMetrics
      showIdInName
      showSearch
      enableFilters
      filterContext={{ channel: 'DISTRIBUCION' }}
      drillToDetail
      breadcrumbs={<DistribucionBreadcrumbs listLabel="Regionales" listPath="/distribucion/regionales" />}
    />
  );
}
