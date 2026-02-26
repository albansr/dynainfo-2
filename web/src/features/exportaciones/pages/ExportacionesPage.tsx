import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function ExportacionesPage() {
  return (
    <AnalyticsPage
      title="Canales / Exportaciones"
      groupBy="IdRegional"
      totalsLabel="TOTAL REGIONALES:"
      filters={{ type: 'export' }}
    />
  );
}
