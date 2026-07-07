import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

/**
 * Distribution · Regionales — table-only listing grouped by regional,
 * filtered to the distribution channel.
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
    />
  );
}
