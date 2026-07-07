import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

/**
 * Distribution · Vendedores — table-only listing grouped by seller,
 * filtered to the distribution channel.
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
    />
  );
}
