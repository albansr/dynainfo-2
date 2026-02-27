import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function PortafolioPage() {
  return (
    <AnalyticsPage
      title="Multivariados / Portafolio"
      groupBy="SegmentacionProducto"
      totalsLabel="TOTAL PORTAFOLIO:"
      hideBudgetColumns={true}
    />
  );
}
