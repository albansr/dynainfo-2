import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

/**
 * Distribution Channel Analytics Page
 *
 * Shows sales, budget, and margin analytics grouped by regional distribution.
 */
export function DistributionPage() {
  return (
    <AnalyticsPage
      title="Canales /Distribución"
      groupBy="IdRegional"
      totalsLabel="TOTAL REGIONALES:"
      filters={{ channel: 'DISTRIBUCION' }}
    />
  );
}
