import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function ExportacionesPage() {
  return (
    <AnalyticsPage
      title="Canales / Exportaciones"
      groupBy="customer_country"
      totalsLabel="TOTAL EXPORTACIONES:"
      filters={{ channel: 'EXPORTACIONES' }}
    />
  );
}
