import { subDays, startOfMonth, subMonths } from 'date-fns';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useBalance } from '@/core/api/hooks/useBalance';
import { useBalanceSeries } from '@/core/api/hooks/useBalanceSeries';
import { formatCurrency, formatPercentage, formatPercentageWithSign } from '@/core/utils/formatters';
import { getSalesMetric } from '@/core/utils/salesMetric';
import { PrimaryMetricCard } from '../components/PrimaryMetricCard';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '@/core/components/PageHeader';
import { SegmentDistributionChart } from '../components/SegmentDistributionChart';
import { SalesBarChart } from '../components/SalesBarChart';

const DAY_PRESETS = ['today'] as const;

function getChartConfig(preset: ReturnType<typeof useDateRange>['preset'], endDate: Date) {
  const isDay = typeof preset === 'string' && (DAY_PRESETS as readonly string[]).includes(preset);
  const granularity: 'day' | 'month' = isDay ? 'day' : 'month';
  const chartEnd = endDate;
  const chartStart = granularity === 'day'
    ? subDays(endDate, 11)
    : startOfMonth(subMonths(endDate, 11));
  return { granularity, chartStart, chartEnd };
}

export function DashboardPage() {
  const { startDate, endDate, preset } = useDateRange();
  const { data, isLoading } = useBalance(startDate, endDate);

  const balanceData = data?.data;
  const currentYear = endDate.getFullYear();
  const previousYear = currentYear - 1;
  const salesMetric = getSalesMetric(balanceData, preset);

  const { granularity, chartStart, chartEnd } = getChartConfig(preset, endDate);
  const { data: seriesData, isLoading: seriesLoading } = useBalanceSeries(chartStart, chartEnd, granularity);

  return (
    <div>
      <PageHeader title="Análisis General de la compañía" />

      {/* Ventas */}
      <div className="border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          <PrimaryMetricCard
            label={salesMetric.label}
            mainValue={`$ ${balanceData ? formatCurrency(salesMetric.current) : '0'}`}
            secondaryLabel={`Año anterior (${previousYear})`}
            secondaryValue={`$ ${balanceData ? formatCurrency(salesMetric.lastYear) : '0'}`}
            isLoading={isLoading}
          />

          <MetricCard
            label="CRECIMIENTO DE VENTAS"
            value={
              <span className={balanceData && salesMetric.vsLastYear >= 0 ? 'text-green-600' : 'text-red-600'}>
                {balanceData ? formatPercentageWithSign(salesMetric.vsLastYear) : '0'}%
              </span>
            }
            description="vs año anterior"
            isLoading={isLoading}
            centered
          />

          <MetricCard
            label="CUMPL. PRESUPUESTO"
            value={`${balanceData ? formatPercentage(balanceData.budget_achievement_pct) : '0'}%`}
            description={`Ppto: $ ${balanceData ? formatCurrency(balanceData.budget) : '0'}`}
            isLoading={isLoading}
            centered
          />
        </div>
      </div>

      {/* Márgenes */}
      <div className="mt-8 border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
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
                    const absDiff = Math.abs(diff);
                    const text = absDiff < 0.01
                      ? 'En línea con ppto'
                      : diff > 0
                        ? `Real bajo ppto en ${formatPercentage(absDiff)}pp`
                        : `Real supera ppto en ${formatPercentage(absDiff)}pp`;
                    return (
                      <span className={diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-zinc-500'}>
                        {text}
                      </span>
                    );
                  })()
                : 'En línea con ppto'
            }
            isLoading={isLoading}
            centered
          />
        </div>
      </div>

      {/* Cartera */}
      <div className="mt-8 border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
          <MetricCard
            label="CARTERA"
            value={`$ ${balanceData ? formatCurrency(balanceData.cartera) : '0'}`}
            description={`Cumpl. ppto con cartera: ${balanceData ? formatPercentage(balanceData.cartera_compliance_pct) : '0'}%`}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Gráfico tendencia */}
      <div className="mt-8 border border-gray-200 rounded-lg p-4 sm:p-6">
        <SalesBarChart
          series={seriesData?.data ?? []}
          granularity={granularity}
          title={`Tendencia de ventas — últimos 12 ${granularity === 'day' ? 'días' : 'meses'}`}
          isLoading={seriesLoading}
        />
      </div>

      {/* Análisis IA */}
      <div className="mt-8 border border-gray-200 rounded-lg p-4 sm:p-6">
        <SegmentDistributionChart />
      </div>

      <div className="pb-64" />
    </div>
  );
}
