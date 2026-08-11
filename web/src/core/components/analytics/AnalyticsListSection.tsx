import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pagination, Input } from '@heroui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useAnalyticsData } from './hooks/useAnalyticsData';
import { RegionalTable, type RegionalData } from '@/features/distribution/components/RegionalTable';
import {
  getColumnsWithoutBudget,
  getColumnsWithDynamicLabel,
  getColumnGroupsWithoutBudget,
  getColumnGroups,
} from '@/features/distribution/components/RegionalTable/config/columns';
import type { ColumnDefinition, ColumnGroup } from '@/features/distribution/components/RegionalTable/config/types';
import { getSalesMetric, type SalesMetricPreset } from '@/core/utils/salesMetric';
import type { BalanceSheetData } from '@/core/api/types';
import type { GroupByDimension, ListItemResponse } from '@/core/api/hooks/useList';
import { FacetedFilterChips, FacetedFilterAddButton, type AppliedFilters } from '@/features/distribution/components/FacetedFilterBar';
import { ExportToExcelButton } from './ExportToExcelButton';

/** Totals row from the current page's mapped rows. */
function calculateTotals(data: RegionalData[], totalsLabel: string): RegionalData {
  const totals = data.reduce(
    (acc, item) => ({
      salesCurrent: acc.salesCurrent + item.sales.current,
      salesPrevious: acc.salesPrevious + item.sales.previous,
      budgetAmount: acc.budgetAmount + item.budget.amount,
      budgetMargin: acc.budgetMargin + (item.margin.budget * item.budget.amount) / 100,
      retainedAmount: acc.retainedAmount + item.retained.amount,
    }),
    { salesCurrent: 0, salesPrevious: 0, budgetAmount: 0, budgetMargin: 0, retainedAmount: 0 }
  );
  const salesVariation = totals.salesPrevious !== 0
    ? ((totals.salesCurrent - totals.salesPrevious) / totals.salesPrevious) * 100 : 0;
  const budgetCompliance = totals.budgetAmount !== 0 ? (totals.salesCurrent / totals.budgetAmount) * 100 : 0;
  const marginCurrent = totals.salesCurrent !== 0
    ? data.reduce((acc, item) => acc + item.margin.current * item.sales.current, 0) / totals.salesCurrent : 0;
  const marginPrevious = totals.salesPrevious !== 0
    ? data.reduce((acc, item) => acc + item.margin.previous * item.sales.previous, 0) / totals.salesPrevious : 0;
  const marginBudget = totals.budgetAmount !== 0 ? totals.budgetMargin / totals.budgetAmount : 0;
  // Variación en puntos porcentuales (20% → 25% = +5), no crecimiento relativo.
  const marginVariation = totals.salesPrevious !== 0 ? marginCurrent - marginPrevious : 0;
  const retainedCompliance = totals.budgetAmount !== 0 ? (totals.retainedAmount / totals.budgetAmount) * 100 : 0;
  return {
    id: 'totals',
    name: totalsLabel,
    sales: { current: totals.salesCurrent, previous: totals.salesPrevious, variation: salesVariation },
    budget: { amount: totals.budgetAmount, compliance: budgetCompliance },
    margin: { current: marginCurrent, previous: marginPrevious, variation: marginVariation, budget: marginBudget },
    retained: { amount: totals.retainedAmount, compliance: retainedCompliance },
  };
}

/** Totals row from the backend aggregate (whole filtered dataset, not just the page). */
function buildTotalsFromBalance(balance: BalanceSheetData, preset: SalesMetricPreset, totalsLabel: string): RegionalData {
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

export interface AnalyticsListSectionProps {
  groupBy: GroupByDimension;
  filters?: Record<string, any>;
  totalsLabel?: string;
  tableColumns?: ColumnDefinition[];
  tableColumnGroups?: ColumnGroup[];
  hideBudgetColumns?: boolean;
  hideRetainedColumn?: boolean;
  nameOverrides?: Record<string, string>;
  showIdInName?: boolean;
  dimensionLabel?: string;
  pageSize?: number;
  showSearch?: boolean;
  /** When set, table rows are clickable and call this with the row. */
  onRowClick?: (row: RegionalData) => void;
  /** Report title used for the Excel export. */
  reportTitle: string;
  /** Show the faceted multi-select filter bar. */
  enableFilters?: boolean;
  /** Context (e.g. channel) that scopes the filter value options. */
  filterContext?: Record<string, any>;
}

/**
 * Headless analytics list: data fetch + search + export + table + pagination
 * + totals. Rendered by AnalyticsPage (below the header/metrics) and reused by
 * the drill-down breakdown.
 */
export function AnalyticsListSection({
  groupBy,
  filters,
  totalsLabel = 'TOTAL:',
  tableColumns,
  tableColumnGroups,
  hideBudgetColumns = false,
  hideRetainedColumn = false,
  nameOverrides,
  showIdInName = false,
  dimensionLabel,
  pageSize = 50,
  showSearch = false,
  onRowClick,
  reportTitle,
  enableFilters = false,
  filterContext,
}: AnalyticsListSectionProps) {
  const { startDate, endDate, preset } = useDateRange();

  // Faceted filters (dimension → selected values); merged into the base filters
  const [applied, setApplied] = useState<AppliedFilters>({});
  const effectiveFilters = useMemo(() => {
    const merged: Record<string, any> = { ...filters };
    for (const [dim, values] of Object.entries(applied)) {
      if (values.length) merged[dim] = values.map((v) => v.id);
    }
    return merged;
  }, [filters, applied]);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [groupBy, startDate, endDate, preset, pageSize, debouncedSearch, effectiveFilters]);

  const { balanceData, listData, listMeta, isLoading } = useAnalyticsData(
    groupBy, startDate, endDate, preset, effectiveFilters, page, pageSize, debouncedSearch
  );

  const totalPages = listMeta?.totalPages ?? 1;

  const mapApiToRegionalData = useCallback(
    (item: ListItemResponse): RegionalData => {
      const sales = getSalesMetric(item, preset);
      return {
        id: item.id,
        name: item.name,
        sales: { current: sales.current, previous: sales.lastYear, variation: sales.vsLastYear },
        budget: { amount: item.budget, compliance: item.budget_achievement_pct },
        margin: {
          current: item.gross_margin_pct,
          previous: item.gross_margin_pct_last_year,
          variation: item.gross_margin_pct_vs_last_year,
          budget: item.budget_gross_margin_pct,
        },
        retained: { amount: item.cartera, compliance: item.cartera_compliance_pct },
      };
    },
    [preset]
  );

  const mappedData = useMemo(
    () => (listData || []).map((item) => {
      const data = mapApiToRegionalData(item);
      let name = data.name;
      if (nameOverrides && name in nameOverrides) name = nameOverrides[name]!;
      if (showIdInName && data.id && data.id !== name) name = `${data.id} - ${name}`;
      return { ...data, name };
    }),
    [listData, nameOverrides, showIdInName, mapApiToRegionalData]
  );

  const totals = useMemo(
    () => balanceData
      ? buildTotalsFromBalance(balanceData, preset, totalsLabel)
      : calculateTotals(mappedData, totalsLabel),
    [balanceData, preset, mappedData, totalsLabel]
  );

  const columns = useMemo(() => {
    if (tableColumns) return tableColumns;
    let cols = hideBudgetColumns
      ? getColumnsWithoutBudget(groupBy, hideRetainedColumn)
      : getColumnsWithDynamicLabel(groupBy);
    if (hideRetainedColumn && !hideBudgetColumns) cols = cols.filter((col) => col.id !== 'retained');
    if (dimensionLabel) {
      cols = cols.map((col) =>
        col.id === 'regional' ? { ...col, header: { ...col.header, label: dimensionLabel } } : col
      );
    }
    return cols;
  }, [tableColumns, hideBudgetColumns, hideRetainedColumn, groupBy, dimensionLabel]);

  const columnGroups = useMemo(() => {
    if (tableColumnGroups) return tableColumnGroups;
    return hideBudgetColumns ? getColumnGroupsWithoutBudget() : getColumnGroups(preset);
  }, [tableColumnGroups, hideBudgetColumns, preset]);

  const currentYear = endDate.getFullYear();

  const hasChips = enableFilters && Object.values(applied).some((v) => v.length);

  return (
    <>
      {hasChips && (
        <div className="mt-8">
          <FacetedFilterChips value={applied} onChange={setApplied} contextFilters={filterContext} />
        </div>
      )}

      {/* Search + (Add filter + Export) */}
      <div className={`${hasChips ? 'mt-3' : 'mt-8'} flex items-center justify-between gap-3`}>
        {showSearch ? (
          <div className="flex items-center gap-2">
            <Input
              size="sm"
              className="w-80"
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
        <div className="flex items-center gap-2">
          {enableFilters && (
            <FacetedFilterAddButton value={applied} onChange={setApplied} contextFilters={filterContext} />
          )}
          <ExportToExcelButton
            groupBy={groupBy}
            startDate={startDate}
            endDate={endDate}
            preset={preset}
            filters={effectiveFilters}
            totalsLabel={totalsLabel}
            hideBudgetColumns={hideBudgetColumns}
            hideRetainedColumn={hideRetainedColumn}
            nameOverrides={nameOverrides}
            reportTitle={reportTitle}
            dimensionLabelOverride={dimensionLabel}
            disabled={isLoading}
          />
        </div>
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
          onRowClick={onRowClick}
          config={{ currency: '$', locale: 'es-CO', currentYear, previousYear: currentYear - 1 }}
          className="mt-3"
        />
      )}

      {!isLoading && totalPages > 1 && (
        <div className="mt-4 flex flex-col items-center gap-1">
          <Pagination showControls page={page} total={totalPages} onChange={setPage} size="sm" variant="light" />
          {listMeta && (
            <span className="text-xs text-zinc-400">
              {listMeta.total.toLocaleString('es-CO')} registros · página {page} de {totalPages}
            </span>
          )}
        </div>
      )}
    </>
  );
}
