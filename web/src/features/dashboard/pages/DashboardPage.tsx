import { useDateRange } from '@/core/hooks/useDateRange';
import { useBalance } from '@/core/api/hooks/useBalance';
import { formatCurrency, formatPercentage, formatPercentageWithSign } from '@/core/utils/formatters';
import { PrimaryMetricCard } from '../components/PrimaryMetricCard';
import { MetricCard } from '../components/MetricCard';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '@/core/components/PageHeader';
import { dashboardTableColumns, getDashboardTableRows } from '../config/tableConfig';

export function DashboardPage() {
  const { startDate, endDate, preset } = useDateRange();
  const { data, isLoading } = useBalance(startDate, endDate);

  const balanceData = data?.data;
  const currentYear = endDate.getFullYear();
  const previousYear = currentYear - 1;

  // Map preset to label
  const getPresetLabel = (preset: number | string): string => {
    if (typeof preset === 'number') return ''; // Don't show year in label
    const presetMap: Record<string, string> = {
      'current-month': 'Mes actual',
      'accumulated': 'Acumulado',
      'last-30-days': 'Últimos 30 días',
      'last-6-months': 'Últimos 6 meses',
      'last-12-months': 'Últimos 12 meses',
    };
    return presetMap[preset] || preset;
  };

  const periodLabel = getPresetLabel(preset);
  const labelText = 'VENTAS (Facturado + comprometido)';

  const tableRows = getDashboardTableRows(balanceData);

  return (
    <div>
      <PageHeader title="Análisis General de la compañía" />

      <div className="border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-4 gap-8">
          <PrimaryMetricCard
            label={labelText}
            mainValue={`US$ ${balanceData ? formatCurrency(balanceData.sales) : '0'}`}
            secondaryLabel={`Año anterior (${previousYear})`}
            secondaryValue={`US$ ${balanceData ? formatCurrency(balanceData.sales_last_year) : '0'}`}
            isLoading={isLoading}
          />

          <MetricCard
            label="CRECIMIENTO DE VENTAS"
            value={
              <span className={balanceData && balanceData.sales_vs_last_year >= 0 ? 'text-green-600' : 'text-red-600'}>
                {balanceData ? formatPercentageWithSign(balanceData.sales_vs_last_year) : '0'}%
              </span>
            }
            description="vs año anterior"
            isLoading={isLoading}
            centered
          />

          <MetricCard
            label="CUMPLIMIENTO PARCIAL"
            value={`${balanceData ? formatPercentage(balanceData.budget_achievement_pct) : '0'}%`}
            description={`US$ ${balanceData ? formatCurrency(balanceData.budget) : '0'}`}
            isLoading={isLoading}
            centered
          />
        </div>
      </div>

      <div className="mt-8 border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-4 gap-8">
          <PrimaryMetricCard
            label="MARGEN BRUTO"
            mainValue={
              balanceData && balanceData.sales !== 0
                ? `${formatPercentage((balanceData.gross_margin / balanceData.sales) * 100)}%`
                : '0%'
            }
            secondaryLabel={`Año anterior (${previousYear})`}
            secondaryValue={
              balanceData && balanceData.sales_last_year !== 0
                ? `${formatPercentage((balanceData.gross_margin_last_year / balanceData.sales_last_year) * 100)}%`
                : '0%'
            }
            isLoading={isLoading}
          />

          <MetricCard
            label="CRECIMIENTO MARGEN"
            value={
              balanceData
                ? (() => {
                    const marginPct = balanceData.sales !== 0 ? (balanceData.gross_margin / balanceData.sales) * 100 : 0;
                    const marginPctLastYear = balanceData.sales_last_year !== 0 ? (balanceData.gross_margin_last_year / balanceData.sales_last_year) * 100 : 0;
                    const variation = marginPctLastYear !== 0 ? ((marginPct - marginPctLastYear) / marginPctLastYear) * 100 : 0;
                    return (
                      <span className={variation >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatPercentageWithSign(variation)}%
                      </span>
                    );
                  })()
                : '0%'
            }
            description="vs año anterior"
            isLoading={isLoading}
            centered
          />

          <MetricCard
            label="MARGEN PRESUPUESTADO"
            value={`${balanceData ? formatPercentage(balanceData.budget_gross_margin_pct) : '0'}%`}
            description={
              balanceData
                ? (() => {
                    const realMargin = balanceData.sales !== 0 ? (balanceData.gross_margin / balanceData.sales) * 100 : 0;
                    const budgetMargin = balanceData.budget_gross_margin_pct;
                    const diff = budgetMargin - realMargin;
                    return (
                      <span className={diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-zinc-500'}>
                        {formatPercentageWithSign(diff)}pp vs real
                      </span>
                    );
                  })()
                : '0pp vs real'
            }
            isLoading={isLoading}
            centered
          />
        </div>
      </div>

      <DataTable
        columns={dashboardTableColumns}
        rows={tableRows}
        isLoading={isLoading}
        className="mt-8"
      />
    </div>
  );
}
