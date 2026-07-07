import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pagination, Input } from '@heroui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useAnalyticsData } from './hooks/useAnalyticsData';
import { StandardMetrics } from './presets/standardMetrics';
import { PageHeader } from '@/core/components/PageHeader';
import { RegionalTable, type RegionalData } from '@/features/distribution/components/RegionalTable';
import {
  getColumnsWithoutBudget,
  getColumnsWithDynamicLabel,
  getColumnGroupsWithoutBudget,
  getColumnGroups,
} from '@/features/distribution/components/RegionalTable/config/columns';
import { getSalesMetric, type SalesMetricPreset } from '@/core/utils/salesMetric';
import type { BalanceSheetData } from '@/core/api/types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getRoleChannelLabel } from '@/core/config/access';
import { ExportToExcelButton } from './ExportToExcelButton';
import type { AnalyticsPageConfig } from './types';
import type { ListItemResponse } from '@/core/api/hooks/useList';

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
 * Build the totals row from the backend aggregate (whole filtered dataset),
 * so the TOTAL reflects ALL rows — not just the current page.
 */
function buildTotalsFromBalance(
  balance: BalanceSheetData,
  preset: SalesMetricPreset,
  totalsLabel: string
): RegionalData {
  const sales = getSalesMetric(balance, preset);
  return {
    id: 'totals',
    name: totalsLabel,
    sales: { current: sales.current, previous: sales.lastYear, variation: sales.vsLastYear },
    budget: { amount: balance.budget, compliance: balance.budget_achievement_pct },
    margin: {
      current: balance.gross_margin_pct,
      previous: balance.gross_margin_pct_last_year ?? NaN,
      variation: balance.gross_margin_pct_vs_last_year ?? NaN,
      budget: balance.budget_gross_margin_pct,
    },
    retained: { amount: balance.cartera, compliance: balance.cartera_compliance_pct },
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
  hideRetainedColumn = false,
  nameOverrides,
  hideMetrics = false,
  showIdInName = false,
  dimensionLabel,
  pageSize = 50,
  showSearch = false,
}: AnalyticsPageConfig) {
  const { startDate, endDate, preset } = useDateRange();
  const { user } = useAuth();
  const channelLabel = getRoleChannelLabel(user?.dynaRole);

  // Search input with debounce (server-side search across the whole dataset)
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to the first page when the query inputs change
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [groupBy, startDate, endDate, preset, pageSize, debouncedSearch]);

  // Fetch balance data for metrics and list data for table
  const { balanceData, listData, listMeta, isLoading } = useAnalyticsData(
    groupBy,
    startDate,
    endDate,
    preset,
    filters,
    page,
    pageSize,
    debouncedSearch
  );

  const totalPages = listMeta?.totalPages ?? 1;

  // Map API response to RegionalData format (preset-aware sales metric)
  const mapApiToRegionalData = useCallback(
    (item: ListItemResponse): RegionalData => {
      const sales = getSalesMetric(item, preset);
      return {
        id: item.id,
        name: item.name,
        sales: {
          current: sales.current,
          previous: sales.lastYear,
          variation: sales.vsLastYear,
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
    },
    [preset]
  );

  const mappedData = useMemo(
    () => (listData || []).map(item => {
      const data = mapApiToRegionalData(item);
      let name = data.name;
      if (nameOverrides && name in nameOverrides) {
        name = nameOverrides[name]!;
      }
      if (showIdInName && data.id && data.id !== name) {
        name = `${data.id} - ${name}`;
      }
      return { ...data, name };
    }),
    [listData, nameOverrides, showIdInName, mapApiToRegionalData]
  );

  // Totals row: use the backend aggregate (grand total across ALL rows) when
  // available; fall back to the current page's sum otherwise.
  const totals = useMemo(
    () => balanceData
      ? buildTotalsFromBalance(balanceData, preset, totalsLabel)
      : calculateTotals(mappedData, totalsLabel),
    [balanceData, preset, mappedData, totalsLabel]
  );

  // Compute columns and groups based on configuration
  const columns = useMemo(() => {
    if (tableColumns) return tableColumns;
    let cols = hideBudgetColumns
      ? getColumnsWithoutBudget(groupBy, hideRetainedColumn)
      : getColumnsWithDynamicLabel(groupBy);
    if (hideRetainedColumn && !hideBudgetColumns) {
      cols = cols.filter(col => col.id !== 'retained');
    }
    if (dimensionLabel) {
      cols = cols.map(col =>
        col.id === 'regional'
          ? { ...col, header: { ...col.header, label: dimensionLabel } }
          : col
      );
    }
    return cols;
  }, [tableColumns, hideBudgetColumns, hideRetainedColumn, groupBy, dimensionLabel]);

  const columnGroups = useMemo(() => {
    if (tableColumnGroups) return tableColumnGroups;
    return hideBudgetColumns ? getColumnGroupsWithoutBudget() : getColumnGroups(preset);
  }, [tableColumnGroups, hideBudgetColumns, preset]);

  const currentYear = endDate.getFullYear();

  return (
    <div>
      <PageHeader title={title} chip={channelLabel ? `Canal ${channelLabel}` : undefined} />

      {/* Metrics */}
      {!hideMetrics && metricsPreset === 'standard' && (
        <StandardMetrics
          balanceData={balanceData}
          endDate={endDate}
          preset={preset}
          isLoading={isLoading}
        />
      )}

      {/* Search + Export */}
      <div className="mt-8 flex items-center justify-between gap-3">
        {showSearch ? (
          <div className="flex items-center gap-2">
            <Input
              size="sm"
              className="max-w-xs"
              placeholder="Buscar por nombre o ID..."
              value={searchInput}
              onValueChange={setSearchInput}
              isClearable
              onClear={() => setSearchInput('')}
              startContent={<MagnifyingGlassIcon className="h-4 w-4 text-default-400" />}
            />
            {listMeta && (
              <span className="text-xs text-default-400 whitespace-nowrap">
                {listMeta.total.toLocaleString('es-CO')} resultados
              </span>
            )}
          </div>
        ) : (
          <div />
        )}
        <ExportToExcelButton
          groupBy={groupBy}
          startDate={startDate}
          endDate={endDate}
          preset={preset}
          filters={filters}
          totalsLabel={totalsLabel}
          hideBudgetColumns={hideBudgetColumns}
          hideRetainedColumn={hideRetainedColumn}
          nameOverrides={nameOverrides}
          reportTitle={title}
          dimensionLabelOverride={dimensionLabel}
          disabled={isLoading}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="mt-3 flex items-center justify-center h-64">
          <div className="text-zinc-500">Cargando datos...</div>
        </div>
      ) : (
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
          className="mt-3"
        />
      )}

      {!isLoading && totalPages > 1 && (
        <div className="mt-4 flex flex-col items-center gap-1">
          <Pagination
            showControls
            page={page}
            total={totalPages}
            onChange={setPage}
            size="sm"
            variant="light"
          />
          {listMeta && (
            <span className="text-xs text-zinc-400">
              {listMeta.total.toLocaleString('es-CO')} registros · página {page} de {totalPages}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
