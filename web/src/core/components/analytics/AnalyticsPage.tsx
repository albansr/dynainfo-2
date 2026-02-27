import { useMemo } from 'react';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useAnalyticsData } from './hooks/useAnalyticsData';
import { StandardMetrics } from './presets/standardMetrics';
import { PageHeader } from '@/core/components/PageHeader';
import { RegionalTable, type RegionalData } from '@/features/distribution/components/RegionalTable';
import {
  getColumnsWithoutBudget,
  getColumnsWithDynamicLabel,
  getColumnGroupsWithoutBudget,
  COLUMN_GROUPS,
} from '@/features/distribution/components/RegionalTable/config/columns';
import type { AnalyticsPageConfig } from './types';
import type { ListItemResponse } from '@/core/api/hooks/useList';

/**
 * Map API response to RegionalData format
 */
function mapApiToRegionalData(item: ListItemResponse): RegionalData {
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
      previous: item.gross_margin_pct_last_year,
      variation: item.gross_margin_pct_vs_last_year,
      budget: item.budget_gross_margin_pct,
    },
    retained: {
      amount: item.cartera,
      compliance: item.cartera_compliance_pct,
    },
  };
}

/**
 * Calculate totals row from mapped data
 */
function calculateTotals(data: RegionalData[], totalsLabel: string): RegionalData {
  const totals = data.reduce(
    (acc, item) => ({
      salesCurrent: acc.salesCurrent + item.sales.current,
      salesPrevious: acc.salesPrevious + item.sales.previous,
      budgetAmount: acc.budgetAmount + item.budget.amount,
      budgetMargin: acc.budgetMargin + (item.margin.budget * item.budget.amount) / 100,
      retainedAmount: acc.retainedAmount + item.retained.amount,
    }),
    {
      salesCurrent: 0,
      salesPrevious: 0,
      budgetAmount: 0,
      budgetMargin: 0,
      retainedAmount: 0,
    }
  );

  const salesVariation =
    totals.salesPrevious !== 0
      ? ((totals.salesCurrent - totals.salesPrevious) / totals.salesPrevious) * 100
      : 0;

  const budgetCompliance =
    totals.budgetAmount !== 0 ? (totals.salesCurrent / totals.budgetAmount) * 100 : 0;

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
    name: totalsLabel,
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

/**
 * Generic Analytics Page Component
 *
 * Creates an analytics page with metrics and data table based on configuration.
 * Automatically handles data fetching, date range selection, filtering, and rendering.
 *
 * @example
 * <AnalyticsPage
 *   title="Canales / Distribución"
 *   groupBy="IdRegional"
 *   totalsLabel="TOTAL REGIONALES:"
 * />
 *
 * @example
 * // With filters
 * <AnalyticsPage
 *   title="Canales / Exportaciones"
 *   groupBy="IdRegional"
 *   filters={{ type: 'export' }}
 * />
 */
export function AnalyticsPage({
  title,
  groupBy,
  totalsLabel = 'TOTAL:',
  filters,
  metricsPreset = 'standard',
  tableColumns,
  tableColumnGroups,
  hideBudgetColumns = false,
}: AnalyticsPageConfig) {
  const { startDate, endDate } = useDateRange();

  // Fetch balance data for metrics and list data for table
  const { balanceData, listData, isLoading } = useAnalyticsData(
    groupBy,
    startDate,
    endDate,
    filters
  );

  // Map API response to RegionalData format
  const mappedData = useMemo(
    () => (listData || []).map(mapApiToRegionalData),
    [listData]
  );

  // Calculate totals for table footer
  const totals = useMemo(
    () => calculateTotals(mappedData, totalsLabel),
    [mappedData, totalsLabel]
  );

  // Compute columns and groups based on configuration
  const columns = useMemo(() => {
    if (tableColumns) return tableColumns;
    return hideBudgetColumns
      ? getColumnsWithoutBudget(groupBy)
      : getColumnsWithDynamicLabel(groupBy);
  }, [tableColumns, hideBudgetColumns, groupBy]);

  const columnGroups = useMemo(() => {
    if (tableColumnGroups) return tableColumnGroups;
    return hideBudgetColumns ? getColumnGroupsWithoutBudget() : COLUMN_GROUPS;
  }, [tableColumnGroups, hideBudgetColumns]);

  const currentYear = endDate.getFullYear();

  if (isLoading) {
    return (
      <div>
        <PageHeader title={title} />
        <div className="flex items-center justify-center h-64">
          <div className="text-zinc-500">Cargando datos...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} />

      {/* Metrics */}
      {metricsPreset === 'standard' && (
        <StandardMetrics
          balanceData={balanceData}
          endDate={endDate}
          isLoading={isLoading}
        />
      )}

      {/* Table */}
      <RegionalTable
        data={mappedData}
        totals={totals}
        columns={columns}
        columnGroups={columnGroups}
        config={{
          currency: '$',
          locale: 'es-CO',
          currentYear,
          previousYear: currentYear - 1,
        }}
        className="mt-8"
      />
    </div>
  );
}
