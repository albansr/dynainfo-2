import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function ClientesPage() {
  return (
    <AnalyticsPage
      title="Multivariados / Clientes"
      groupBy="seller_id"
      totalsLabel="TOTAL CLIENTES:"
    />
  );
}
