import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterMap } from '@/core/api/downloadExcel';
import { Pagination, Input } from '@heroui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useAnalyticsData } from './hooks/useAnalyticsData';
import { RegionalTable, type RegionalData } from '@/core/components/RegionalTable';
import {
  getColumnsWithoutBudget,
  getColumnsWithDynamicLabel,
  getColumnGroupsWithoutBudget,
  getColumnGroups,
  toProductListingColumns,
} from '@/core/components/RegionalTable/config/columns';
import type { ColumnDefinition, ColumnGroup } from '@/core/components/RegionalTable/config/types';
import { getSalesMetric, getUnitMetric, type SalesMetricPreset, type UnitMetricValues } from '@/core/utils/salesMetric';
import type { BalanceSheetData } from '@/core/api/types';
import type { GroupByDimension, ListItemResponse } from '@/core/api/hooks/useList';
import { FacetedFilterChips, FacetedFilterAddButton, type AppliedFilters } from '@/core/components/analytics/FacetedFilterBar';
import { ExportToExcelButton } from './ExportToExcelButton';
import { DEFAULT_CUSTOMER_PRESET, type CustomerPreset } from '@/core/config/customerPresets';
import { groupingShowsCartera } from '@/core/config/breakdownDimensions';

/** Leading ABC-position column (#) for the seller peso (80%) list. */
const RANK_COLUMN: ColumnDefinition = {
  id: 'rank',
  header: { label: 'ABC', align: 'left', rowSpan: 2 },
  accessor: (data) => data.rank ?? '',
  cellRenderer: (_data, _config, value) =>
    value === '' || value == null ? '' : <div className="px-4 py-2.5 text-[12px] font-medium text-zinc-400">{String(value)}</div>,
  align: 'left',
  sortable: false,
};

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

/** Table units slot from the resolved unit metrics (current + last year). */
function toTableUnits(u: UnitMetricValues): NonNullable<RegionalData['units']> {
  return {
    current: u.units,
    previous: u.unitsLastYear,
    avgCost: u.avgCost,
    avgCostPrevious: u.avgCostLastYear,
    avgPrice: u.avgPrice,
    avgPricePrevious: u.avgPriceLastYear,
  };
}

/** Totals row from the backend aggregate (whole filtered dataset, not just the page). */
function buildTotalsFromBalance(
  balance: BalanceSheetData,
  preset: SalesMetricPreset,
  totalsLabel: string,
  withUnits: boolean
): RegionalData {
  const sales = getSalesMetric(balance, preset);
  const units = withUnits ? getUnitMetric(balance, preset) : undefined;
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
    ...(units ? { units: toTableUnits(units) } : {}),
  };
}

export interface AnalyticsListSectionProps {
  groupBy: GroupByDimension;
  filters?: FilterMap;
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
  filterContext?: FilterMap;
  /** Seller client-preset lens (drill from the Estado page). Adds a billing rank. */
  customerPreset?: CustomerPreset;
  /** Fixed window override — Estado drills use a per-criterion window, not the global temporality. */
  dateOverride?: { startDate: Date; endDate: Date; preset: SalesMetricPreset };
  /** Hide the totals row (simple client lists with no meaningful aggregate). */
  hideTotals?: boolean;
}

/**
 * Headless analytics list: data fetch + search + export + table + pagination
 * + totals. Reused by the dimension breakdown table on the dashboard and the
 * detail explorer.
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
  customerPreset = DEFAULT_CUSTOMER_PRESET,
  dateOverride,
  hideTotals = false,
}: AnalyticsListSectionProps) {
  // Only the "peso" (80% of sales) list carries a rank — the client's ABC position
  // by contribution. Other preset lists show no sequential count.
  const showRank = customerPreset === 'peso';
  const isProductListing = groupBy === 'product_id';
  // RET. CARTERA only where dyna_cartera can break it down (else it always reads 0)
  const hideRetained = hideRetainedColumn || !groupingShowsCartera(groupBy);
  const globalRange = useDateRange();
  const startDate = dateOverride?.startDate ?? globalRange.startDate;
  const endDate = dateOverride?.endDate ?? globalRange.endDate;
  const preset = dateOverride?.preset ?? globalRange.preset;

  // Faceted filters (dimension → selected values); merged into the base filters
  const [applied, setApplied] = useState<AppliedFilters>({});
  const effectiveFilters = useMemo(() => {
    const merged: FilterMap = { ...filters };
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

  // Reset to page 1 whenever the dataset identity changes (group/dates/preset/
  // size/search/filters). Adjust state during render instead of in an effect to
  // avoid the cascading-render smell.
  const [page, setPage] = useState(1);
  const resetKey = `${groupBy}|${startDate.getTime()}|${endDate.getTime()}|${preset}|${pageSize}|${debouncedSearch}|${customerPreset}|${JSON.stringify(effectiveFilters)}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }

  const { balanceData, listData, listMeta, isLoading } = useAnalyticsData(
    groupBy, startDate, endDate, preset, effectiveFilters, page, pageSize, debouncedSearch, customerPreset
  );

  const totalPages = listMeta?.totalPages ?? 1;

  const mapApiToRegionalData = useCallback(
    (item: ListItemResponse): RegionalData => {
      const sales = getSalesMetric(item, preset);
      const units = isProductListing ? getUnitMetric(item, preset) : undefined;
      return {
        id: item.id,
        name: item.name,
        ...(item.code ? { code: item.code } : {}),
        sales: { current: sales.current, previous: sales.lastYear, variation: sales.vsLastYear },
        budget: { amount: item.budget, compliance: item.budget_achievement_pct },
        margin: {
          current: item.gross_margin_pct,
          previous: item.gross_margin_pct_last_year,
          variation: item.gross_margin_pct_vs_last_year,
          budget: item.budget_gross_margin_pct,
        },
        retained: { amount: item.cartera, compliance: item.cartera_compliance_pct },
        ...(units ? { units: toTableUnits(units) } : {}),
      };
    },
    [preset, isProductListing]
  );

  const mappedData = useMemo(
    () => (listData || []).map((item) => {
      const data = mapApiToRegionalData(item);
      let name = data.name;
      if (nameOverrides && name in nameOverrides) name = nameOverrides[name]!;
      // Product listings surface product_id in its own REFERENCIA column, so the
      // id-in-name prefix would be redundant there.
      if (showIdInName && !isProductListing && data.id && data.id !== name) name = `${data.id} - ${name}`;
      // The peso list carries each client's ABC position (server-provided).
      return { ...data, name, ...(item.abcRank != null ? { rank: item.abcRank } : {}) };
    }),
    [listData, nameOverrides, showIdInName, isProductListing, mapApiToRegionalData]
  );

  const totals = useMemo(
    () => balanceData
      ? buildTotalsFromBalance(balanceData, preset, totalsLabel, isProductListing)
      : calculateTotals(mappedData, totalsLabel),
    [balanceData, preset, mappedData, totalsLabel, isProductListing]
  );

  const columns = useMemo(() => {
    if (tableColumns) return tableColumns;
    let cols = hideBudgetColumns
      ? getColumnsWithoutBudget(groupBy, hideRetained)
      : getColumnsWithDynamicLabel(groupBy);
    if (hideRetained && !hideBudgetColumns) cols = cols.filter((col) => col.id !== 'retained');
    if (dimensionLabel) {
      cols = cols.map((col) =>
        col.id === 'regional' ? { ...col, header: { ...col.header, label: dimensionLabel } } : col
      );
    }
    // Product listings: CÓDIGO ITEM + REFERENCIA first, UNIDADES + COSTO PROMEDIO instead of CARTERA.
    if (isProductListing) cols = toProductListingColumns(cols);
    // Preset listings lead with a billing-rank column (#).
    if (showRank) cols = [RANK_COLUMN, ...cols];
    return cols;
  }, [tableColumns, hideBudgetColumns, hideRetained, groupBy, dimensionLabel, showRank, isProductListing]);

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
      <div className={`${hasChips ? 'mt-3' : 'mt-8'} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        {showSearch ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              size="sm"
              className="w-full sm:w-80"
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
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
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
            hideRetainedColumn={hideRetained}
            showUnitColumns={isProductListing}
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
          totals={hideTotals ? undefined : totals}
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
