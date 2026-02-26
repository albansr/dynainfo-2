import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function CadenasPage() {
  return (
    <AnalyticsPage
      title="Canales / Cadenas"
      groupBy="IdRegional"
      totalsLabel="TOTAL REGIONALES:"
      filters={{ type: 'chain' }}
    />
  );
}
