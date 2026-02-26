import type { ReactNode } from 'react';
import { formatCurrency, formatPercentage, formatPercentageWithSign } from '@/core/utils/formatters';
import { PrimaryMetricCard } from '@/features/dashboard/components/PrimaryMetricCard';
import { MetricCard } from '@/features/dashboard/components/MetricCard';
import type { BalanceData } from '../types';

interface StandardMetricsProps {
  balanceData: BalanceData | undefined;
  endDate: Date;
  isLoading: boolean;
}

/**
 * Standard metrics layout used across analytics pages
 * Displays sales, growth, and budget compliance metrics in two separate blocks
 */
export function StandardMetrics({ balanceData, endDate, isLoading }: StandardMetricsProps): ReactNode {
  const currentYear = endDate.getFullYear();
  const previousYear = currentYear - 1;
  const labelText = 'VENTAS (Facturado + comprometido)';

  return (
    <>
      {/* Sales Metrics Block */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-4 gap-8">
          <PrimaryMetricCard
            label={labelText}
            mainValue={`$ ${balanceData ? formatCurrency(balanceData.sales) : '0'}`}
            secondaryLabel={`Año anterior (${previousYear})`}
            secondaryValue={`$ ${balanceData ? formatCurrency(balanceData.sales_last_year) : '0'}`}
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
            label="CUMPL. PRESUPUESTO"
            value={`${balanceData ? formatPercentage(balanceData.budget_achievement_pct) : '0'}%`}
            description={`Ppto: $ ${balanceData ? formatCurrency(balanceData.budget) : '0'}`}
            isLoading={isLoading}
            centered
          />
        </div>
      </div>

      {/* Margin Metrics Block */}
      <div className="mt-8 border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-4 gap-8">
          <PrimaryMetricCard
            label="MARGEN BRUTO"
            mainValue={`${balanceData ? formatPercentage(balanceData.gross_margin_pct) : '0'}%`}
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
                    const marginPct = balanceData.gross_margin_pct;
                    const marginPctLastYear = balanceData.sales_last_year !== 0
                      ? (balanceData.gross_margin_last_year / balanceData.sales_last_year) * 100
                      : 0;
                    const variation = marginPctLastYear !== 0
                      ? ((marginPct - marginPctLastYear) / marginPctLastYear) * 100
                      : 0;
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
                    const realMargin = balanceData.gross_margin_pct;
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
    </>
  );
}
