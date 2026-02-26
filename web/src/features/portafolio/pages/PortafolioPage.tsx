import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function PortafolioPage() {
  return (
    <AnalyticsPage
      title="Multivariados / Portafolio"
      groupBy="product_id"
      totalsLabel="TOTAL PORTAFOLIO:"
    />
  );
}
