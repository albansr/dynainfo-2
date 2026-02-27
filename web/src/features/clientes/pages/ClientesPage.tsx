import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function ClientesPage() {
  return (
    <AnalyticsPage
      title="Multivariados / Clientes"
      groupBy="SegmentacionCliente"
      totalsLabel="TOTAL CLIENTES:"
      hideBudgetColumns={true}
    />
  );
}
