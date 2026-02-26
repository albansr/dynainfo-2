import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function CadenasPage() {
  return (
    <AnalyticsPage
      title="Canales / Cadenas"
      groupBy="customer_name"
      totalsLabel="TOTAL CADENAS:"
      filters={{ channel: 'CADENAS' }}
    />
  );
}
