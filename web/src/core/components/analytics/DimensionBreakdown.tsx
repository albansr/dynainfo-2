import { useMemo, useState } from 'react';
import type { FilterMap } from '@/core/api/downloadExcel';
import { SelectItem, SelectSection } from '@heroui/react';
import { AppSelect } from '@/core/components/AppSelect';
import { AnalyticsListSection } from '@/core/components/analytics/AnalyticsListSection';
import type { GroupByDimension } from '@/core/api/hooks/useList';
import type { RegionalData } from '@/core/components/RegionalTable';
import {
  getBreakdownCategories,
  ENTITY_DIMS,
  DIM_LABEL,
} from '@/core/config/breakdownDimensions';

interface DimensionBreakdownProps {
  /** Accumulated context filters (channel + drilled dims). */
  filters: FilterMap;
  /** Initially selected grouping dimension. */
  initialGroupBy: GroupByDimension;
  /** Called when a row is clicked to drill deeper. */
  onDrill: (dim: GroupByDimension, value: string, name: string) => void;
  reportTitle: string;
  /** View-native grouping dims not in the standard catalog (e.g. Centro Operaciones). */
  extraDims?: { key: GroupByDimension; label: string }[];
  /** Column passthrough so a view keeps the look of its former page. */
  totalsLabel?: string;
  hideBudgetColumns?: boolean;
  hideRetainedColumn?: boolean;
  nameOverrides?: Record<string, string>;
}

/**
 * Clickable breakdown list with a category-grouped dimension selector.
 * Grouping by a dimension already in `filters` is excluded from the selector;
 * clicking a row drills into that value.
 */
export function DimensionBreakdown({
  filters,
  initialGroupBy,
  onDrill,
  reportTitle,
  extraDims,
  totalsLabel,
  hideBudgetColumns = true,
  hideRetainedColumn = false,
  nameOverrides,
}: DimensionBreakdownProps) {
  // Reset the grouping when the parent switches view (adjust state during render,
  // not in an effect — avoids the cascading-render smell).
  const [groupBy, setGroupBy] = useState<GroupByDimension>(initialGroupBy);
  const [prevInitial, setPrevInitial] = useState(initialGroupBy);
  if (initialGroupBy !== prevInitial) {
    setPrevInitial(initialGroupBy);
    setGroupBy(initialGroupBy);
  }

  const categories = useMemo(() => getBreakdownCategories(filters), [filters]);
  // Prepend the view's own dimensions (not in the standard catalog) as a section.
  const extraSection = useMemo(() => {
    const dims = (extraDims ?? []).filter((d) => !(d.key in filters));
    return dims.length ? { id: 'vista', label: 'Vista', dims } : null;
  }, [extraDims, filters]);

  const isEntity = ENTITY_DIMS.includes(groupBy);
  const dimLabel = (DIM_LABEL[groupBy] ?? extraDims?.find((d) => d.key === groupBy)?.label ?? groupBy).toUpperCase();

  return (
    <div className="mt-8 border border-zinc-200 rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-700">Desglose por dimensión</h3>
        <AppSelect
          size="sm"
          aria-label="Agrupar por"
          label="Agrupar por"
          selectedKeys={[groupBy]}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0] as GroupByDimension | undefined;
            if (key) setGroupBy(key);
          }}
          className="w-full sm:w-64"
        >
          {[...(extraSection ? [extraSection] : []), ...categories].map((cat) => (
            <SelectSection key={cat.id} title={cat.label} showDivider>
              {cat.dims.map((d) => (
                <SelectItem key={d.key} className="cursor-pointer">{d.label}</SelectItem>
              ))}
            </SelectSection>
          ))}
        </AppSelect>
      </div>

      <AnalyticsListSection
        key={groupBy}
        groupBy={groupBy}
        filters={filters}
        showSearch
        totalsLabel={totalsLabel}
        hideBudgetColumns={hideBudgetColumns}
        hideRetainedColumn={hideRetainedColumn}
        nameOverrides={nameOverrides}
        showIdInName={isEntity}
        dimensionLabel={dimLabel}
        reportTitle={reportTitle}
        enableFilters
        filterContext={filters}
        onRowClick={(row: RegionalData) => onDrill(groupBy, row.id, row.name)}
      />
    </div>
  );
}
