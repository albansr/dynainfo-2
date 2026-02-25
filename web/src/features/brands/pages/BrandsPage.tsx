import { useMemo } from 'react';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useList, type ListItemResponse, type GroupByDimension } from '@/core/api/hooks/useList';
import { useBalance } from '@/core/api/hooks/useBalance';
import { RegionalTable } from '@/features/distribution/components/RegionalTable';
import { PageHeader } from '@/core/components/PageHeader';
import { PrimaryMetricCard } from '@/features/dashboard/components/PrimaryMetricCard';
import { MetricCard } from '@/features/dashboard/components/MetricCard';
import { formatCurrency, formatPercentage, formatPercentageWithSign } from '@/core/utils/formatters';
import type { RegionalData } from '@/features/distribution/components/RegionalTable';

// Map API response to RegionalData format
function mapApiToBrandData(item: ListItemResponse): RegionalData {
  return {
    id: item.id,
    name: item.name,
    sales: {
      current: item.sales,
      previous: item.sales_last_year,
      variation: item.sales_vs_last_year,
    },
    budget: {
      amount: item.budget,
      compliance: item.budget_achievement_pct,
    },
    margin: {
      current: item.gross_margin_pct,
      previous: item.sales_last_year !== 0 ? (item.gross_margin_last_year / item.sales_last_year) * 100 : 0,
      variation: (() => {
        const currentPct = item.gross_margin_pct;
        const previousPct = item.sales_last_year !== 0 ? (item.gross_margin_last_year / item.sales_last_year) * 100 : 0;
        return previousPct !== 0 ? ((currentPct - previousPct) / previousPct) * 100 : 0;
      })(),
      budget: item.budget_gross_margin_pct,
    },
    retained: {
      amount: item.orders,
      compliance: item.order_fulfillment_pct,
    },
  };
}

// Calculate totals from array of data
function calculateTotals(data: RegionalData[]): RegionalData {
  if (data.length === 0) {
    return {
      id: 'totals',
      name: 'TOTAL MARCAS:',
      sales: { current: 0, previous: 0, variation: 0 },
      budget: { amount: 0, compliance: 0 },
      margin: { current: 0, previous: 0, variation: 0, budget: 0 },
      retained: { amount: 0, compliance: 0 },
    };
  }

  const totals = data.reduce(
    (acc, item) => ({
      salesCurrent: acc.salesCurrent + item.sales.current,
      salesPrevious: acc.salesPrevious + item.sales.previous,
      budgetAmount: acc.budgetAmount + item.budget.amount,
      retainedAmount: acc.retainedAmount + item.retained.amount,
      budgetMargin: acc.budgetMargin + (item.margin.budget * item.budget.amount),
    }),
    { salesCurrent: 0, salesPrevious: 0, budgetAmount: 0, retainedAmount: 0, budgetMargin: 0 }
  );

  const salesVariation =
    totals.salesPrevious !== 0
      ? ((totals.salesCurrent - totals.salesPrevious) / totals.salesPrevious) * 100
      : 0;

  const budgetCompliance =
    totals.budgetAmount !== 0 ? (totals.salesCurrent / totals.budgetAmount) * 100 : 0;

  // Calculate weighted average for margins
  const marginCurrent =
    totals.salesCurrent !== 0
      ? data.reduce((acc, item) => acc + (item.margin.current * item.sales.current), 0) /
        totals.salesCurrent
      : 0;

  const marginPrevious =
    totals.salesPrevious !== 0
      ? data.reduce((acc, item) => acc + (item.margin.previous * item.sales.previous), 0) /
        totals.salesPrevious
      : 0;

  const marginBudget =
    totals.budgetAmount !== 0
      ? totals.budgetMargin / totals.budgetAmount
      : 0;

  const marginVariation =
    marginPrevious !== 0
      ? ((marginCurrent - marginPrevious) / marginPrevious) * 100
      : 0;

  const retainedCompliance =
    totals.budgetAmount !== 0 ? (totals.retainedAmount / totals.budgetAmount) * 100 : 0;

  return {
    id: 'totals',
    name: 'TOTAL MARCAS:',
    sales: {
      current: totals.salesCurrent,
      previous: totals.salesPrevious,
      variation: salesVariation,
    },
    budget: {
      amount: totals.budgetAmount,
      compliance: budgetCompliance,
    },
    margin: {
      current: marginCurrent,
      previous: marginPrevious,
      variation: marginVariation,
      budget: marginBudget,
    },
    retained: {
      amount: totals.retainedAmount,
      compliance: retainedCompliance,
    },
  };
}

export function BrandsPage() {
  const { startDate, endDate } = useDateRange();

  // Fetch balance data for metric cards
  const { data: balanceResponse, isLoading: isLoadingBalance } = useBalance(startDate, endDate);
  const balanceData = balanceResponse?.data;

  // Fetch list data for table grouped by product_id (marcas)
  const { data: listData, isLoading: isLoadingList } = useList('product' as GroupByDimension, startDate, endDate);

  // Map API response to BrandData format
  const mappedData = useMemo(
    () => (listData?.data || []).map(mapApiToBrandData),
    [listData]
  );

  // Calculate totals for table footer only
  const totals = useMemo(() => calculateTotals(mappedData), [mappedData]);

  const currentYear = endDate.getFullYear();
  const previousYear = currentYear - 1;

  const isLoading = isLoadingBalance || isLoadingList;

  // const periodLabel = getPresetLabel(preset);
  const labelText = 'VENTAS (Facturado + comprometido)';

  // Calculate margin percentages from balance data
  const marginPct2025 = balanceData && balanceData.sales !== 0 ? (balanceData.gross_margin / balanceData.sales) * 100 : 0;
  const marginPct2024 = balanceData && balanceData.sales_last_year !== 0 ? (balanceData.gross_margin_last_year / balanceData.sales_last_year) * 100 : 0;
  const marginVariation = balanceData && marginPct2024 !== 0 ? ((marginPct2025 - marginPct2024) / marginPct2024) * 100 : 0;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Proveedor Comercial / Marcas" />
        <div className="flex items-center justify-center h-64">
          <div className="text-zinc-500">Cargando datos...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Proveedor Comercial / Marcas" />

      {/* First metrics block */}
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

      {/* Second metrics block */}
      <div className="mt-8 border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-4 gap-8">
          <PrimaryMetricCard
            label="MARGEN BRUTO"
            mainValue={`${formatPercentage(marginPct2025)}%`}
            secondaryLabel={`Año anterior (${previousYear})`}
            secondaryValue={`${formatPercentage(marginPct2024)}%`}
            isLoading={isLoading}
          />

          <MetricCard
            label="CRECIMIENTO MARGEN"
            value={
              <span className={marginVariation >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatPercentageWithSign(marginVariation)}%
              </span>
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

      <RegionalTable
        data={mappedData}
        totals={totals}
        config={{
          currency: 'US$',
          locale: 'es-CO',
          currentYear: new Date().getFullYear(),
          previousYear: new Date().getFullYear() - 1,
        }}
        className="mt-8"
      />
    </div>
  );
}

