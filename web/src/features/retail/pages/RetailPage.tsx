import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function RetailPage() {
  return (
    <AnalyticsPage
      title="Canales / Retail"
      groupBy="CentroOperaciones"
      totalsLabel="TOTAL RETAIL:"
      filters={{ IdRegional: 'RTL' }}
      hideBudgetColumns={true}
      hideRetainedColumn={true}
      nameOverrides={{
        'Punto de venta Centro 2': 'Ventas del centro de operación 006',
        'Punto de venta Itagui': 'Ventas del centro de operación 007',
        'Punto de venta Rionegro': 'Ventas del centro de operación 008',
        '006': 'Punto de venta Centro 2',
        '007': 'Punto de venta Itagui',
        '008': 'Punto de venta Rionegro',
        'COD': 'Ventas C.O.D',
      }}
    />
  );
}
