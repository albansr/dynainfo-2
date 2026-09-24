import type { ReactNode } from 'react';
import type { FilterMap } from '@/core/api/downloadExcel';
import { motion } from 'framer-motion';
import { subDays, startOfMonth, subMonths } from 'date-fns';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useBalance } from '@/core/api/hooks/useBalance';
import { useBalanceSeries } from '@/core/api/hooks/useBalanceSeries';
import { formatCurrency, formatPercentage, formatPercentageWithSign } from '@/core/utils/formatters';
import { getSalesMetric, usesFacturadoOnly } from '@/core/utils/salesMetric';
import { PrimaryMetricCard } from '@/core/components/PrimaryMetricCard';
import { MetricCard } from '@/core/components/MetricCard';
import { PageHeader } from '@/core/components/PageHeader';
import { SegmentDistributionChart } from './SegmentDistributionChart';
import { SalesBarChart } from '@/core/components/SalesBarChart';

// Presets shown with daily granularity in the sales trend chart
const DAY_PRESETS = ['today', 'current-month'] as const;

function getChartConfig(preset: ReturnType<typeof useDateRange>['preset'], endDate: Date) {
  const isDay = typeof preset === 'string' && (DAY_PRESETS as readonly string[]).includes(preset);
  const granularity: 'day' | 'month' = isDay ? 'day' : 'month';
  const chartEnd = endDate;
  let chartStart: Date;
  if (granularity === 'day') {
    // Current month → its days (1..today); "today" → the last 12 days
    chartStart = preset === 'current-month' ? startOfMonth(endDate) : subDays(endDate, 11);
  } else {
    chartStart = startOfMonth(subMonths(endDate, 11));
  }
  return { granularity, chartStart, chartEnd };
}

interface DashboardViewProps {
  title: string;
  chip?: string;
  chipMuted?: boolean;
  breadcrumbs?: ReactNode;
  /** Extra filters (e.g. channel + entity) applied to all dashboard data. */
  filters?: FilterMap;
  /** Restrict the qube6 segment chart's entity selector to these keys. */
  segmentEntityOptions?: string[];
  /** Default selected entity in the qube6 segment chart. */
  segmentDefaultEntity?: string;
  /** Extra content rendered at the bottom (e.g. the drill-down breakdown). */
  footer?: ReactNode;
  /** Control rendered in the header before the date filter (e.g. view selector). */
  leadingControl?: ReactNode;
}

/**
 * Reusable dashboard body (metric cards + sales trend + segment analysis).
 * Used by the main "Inicio" page and by the entity detail pages, which pass
 * an entity filter to scope every metric/chart to a single regional/seller/customer.
 */
export function DashboardView({ title, chip, chipMuted, breadcrumbs, filters, segmentEntityOptions, segmentDefaultEntity, footer, leadingControl }: DashboardViewProps) {
  const { startDate, endDate, preset } = useDateRange();
  const { data, isLoading } = useBalance(startDate, endDate, preset, filters);

  // For prorated presets (today / current month) the budget shown is partial;
  // also surface the full month budget + its compliance, which must always use
  // the WHOLE current month's sales + orders (month-to-date), not the selected
  // range. We fetch a current-month balance for that card; for other presets we
  // reuse the same range so react-query dedupes (no extra request).
  const isDailyPreset = typeof preset === 'string' && (DAY_PRESETS as readonly string[]).includes(preset);
  const monthStart = isDailyPreset ? startOfMonth(endDate) : startDate;
  const monthPreset = isDailyPreset ? 'current-month' : preset;
  const { data: monthData } = useBalance(monthStart, endDate, monthPreset, filters);
  const monthBalance = monthData?.data;

  const balanceData = data?.data;
  const previousYear = endDate.getFullYear() - 1;
  const salesMetric = getSalesMetric(balanceData, preset);

  // Sales split: total (sales_total) = facturado (sales) + comprometido. The
  // comprometido share only matters on open periods; closed periods (facturadoOnly)
  // are fully invoiced, so the split is hidden there.
  const showComprometido = !usesFacturadoOnly(preset);
  const facturado = balanceData?.sales ?? 0;
  const comprometido = balanceData ? balanceData.sales_total - balanceData.sales : 0;
  const salesTotal = balanceData?.sales_total ?? 0;
  const comprometidoPct = salesTotal > 0 ? (comprometido / salesTotal) * 100 : 0;
  const facturadoPct = salesTotal > 0 ? (facturado / salesTotal) * 100 : 0;

  const { granularity, chartStart, chartEnd } = getChartConfig(preset, endDate);
  const { data: seriesData, isLoading: seriesLoading } = useBalanceSeries(
    chartStart,
    chartEnd,
    granularity,
    filters
  );

  return (
    <div>
      <PageHeader title={title} chip={chip} chipMuted={chipMuted} breadcrumbs={breadcrumbs} leadingControl={leadingControl} />

      {/* Ventas */}
      <div className="border border-zinc-200 rounded-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          <PrimaryMetricCard
            label={salesMetric.label}
            mainValue={`$ ${balanceData ? formatCurrency(salesMetric.current) : '0'}`}
            extra={
              showComprometido ? (
                <div className="w-full max-w-md">
                  {/* Part-to-whole meter: Facturado + Comprometido = Ventas */}
                  <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
                    <motion.div
                      className="h-full rounded-full bg-orange-100"
                      initial={{ width: 0 }}
                      animate={{ width: `${facturadoPct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                    <motion.div
                      className="h-full rounded-full bg-orange-400/80"
                      initial={{ width: 0 }}
                      animate={{ width: `${comprometidoPct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-orange-100" />
                      <span className="text-zinc-600">Facturado</span>
                      <span className="font-semibold text-zinc-900">$ {formatCurrency(facturado)}</span>
                      <span className="text-zinc-400">{formatPercentage(facturadoPct)}%</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-orange-400/80" />
                      <span className="text-zinc-600">Comprometido</span>
                      <span className="font-semibold text-zinc-900">$ {formatCurrency(comprometido)}</span>
                      <span className="text-zinc-400">{formatPercentage(comprometidoPct)}%</span>
                    </span>
                  </div>
                </div>
              ) : undefined
            }
            secondaryLabel={`Año anterior (${previousYear})`}
            secondaryValue={`$ ${balanceData ? formatCurrency(salesMetric.lastYear) : '0'}`}
            isLoading={isLoading}
          />

          <MetricCard
            label="CRECIMIENTO DE VENTAS"
            value={
              !balanceData ? (
                <span>0%</span>
              ) : !Number.isFinite(salesMetric.vsLastYear) ? (
                <span className="text-zinc-500">N/A</span>
              ) : (
                <span className={salesMetric.vsLastYear >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatPercentageWithSign(salesMetric.vsLastYear)}%
                </span>
              )
            }
            description="vs año anterior"
            isLoading={isLoading}
            centered
          />

          <MetricCard
            label={isDailyPreset ? 'CUMPL. PPTO (PARCIAL)' : 'CUMPL. PRESUPUESTO'}
            value={`${balanceData ? formatPercentage(balanceData.budget_achievement_pct) : '0'}%`}
            description={`Ppto: $ ${balanceData ? formatCurrency(balanceData.budget) : '0'}`}
            isLoading={isLoading}
            centered
          />
        </div>
      </div>

      {/* Márgenes */}
      <div className="mt-8 border border-zinc-200 rounded-lg p-4 sm:p-6">
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
              balanceData && balanceData.sales_last_year > 0
                ? `${formatPercentage((balanceData.gross_margin_last_year / balanceData.sales_last_year) * 100)}%`
                : 'N/A'
            }
            isLoading={isLoading}
          />

          <MetricCard
            label="VARIACIÓN DEL MARGEN"
            value={
              balanceData
                ? (() => {
                    if (balanceData.sales_last_year <= 0) {
                      return <span className="text-zinc-500">N/A</span>;
                    }
                    const marginPct = balanceData.sales !== 0 ? (balanceData.gross_margin / balanceData.sales) * 100 : 0;
                    const marginPctLastYear = (balanceData.gross_margin_last_year / balanceData.sales_last_year) * 100;
                    // Variación en puntos porcentuales (20% → 25% = +5), no crecimiento relativo.
                    const variation = marginPct - marginPctLastYear;
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
      <div className="mt-8 border border-zinc-200 rounded-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
          <MetricCard
            label="CARTERA"
            value={`$ ${balanceData ? formatCurrency(balanceData.cartera) : '0'}`}
            description={`Cumpl. ppto con cartera: ${balanceData ? formatPercentage(balanceData.cartera_compliance_pct) : '0'}%`}
            isLoading={isLoading}
          />

          {isDailyPreset && (
            <MetricCard
              label="CUMPL. PPTO MES"
              value={`${monthBalance ? formatPercentage(monthBalance.budget_achievement_full_pct) : '0'}%`}
              description={`Ppto mes: $ ${monthBalance ? formatCurrency(monthBalance.budget_full) : '0'}`}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>

      {/* Gráfico tendencia */}
      <div className="mt-8 border border-zinc-200 rounded-lg p-4 sm:p-6">
        <SalesBarChart
          series={seriesData?.data ?? []}
          granularity={granularity}
          title={`Tendencia de ventas — últimos 12 ${granularity === 'day' ? 'días' : 'meses'}`}
          isLoading={seriesLoading}
        />
      </div>

      {/* Análisis IA */}
      <div className="mt-8 border border-zinc-200 rounded-lg p-4 sm:p-6">
        <SegmentDistributionChart
          filters={filters}
          entityOptions={segmentEntityOptions}
          defaultEntity={segmentDefaultEntity}
        />
      </div>

      {footer}

      <div className="pb-64" />
    </div>
  );
}
