import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

/**
 * Distribution · Clientes — table-only listing grouped by customer id
 * (displaying customer name), filtered to the distribution channel.
 */
export function DistribucionClientesPage() {
  return (
    <AnalyticsPage
      title="Clientes"
      groupBy="customer_id"
      totalsLabel="TOTAL CLIENTES:"
      filters={{ channel: 'DISTRIBUCION' }}
      hideMetrics
      showIdInName
      hideBudgetColumns
      pageSize={100}
      showSearch
    />
  );
}
