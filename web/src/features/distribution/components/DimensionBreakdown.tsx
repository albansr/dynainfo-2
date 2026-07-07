import { useEffect, useMemo, useState } from 'react';
import { Select, SelectItem, SelectSection } from '@heroui/react';
import { AnalyticsListSection } from '@/core/components/analytics/AnalyticsListSection';
import type { GroupByDimension } from '@/core/api/hooks/useList';
import type { RegionalData } from '@/features/distribution/components/RegionalTable';
import {
  getBreakdownCategories,
  ENTITY_DIMS,
  DIM_LABEL,
} from '../config/breakdownDimensions';

interface DimensionBreakdownProps {
  /** Accumulated context filters (channel + drilled dims). */
  filters: Record<string, string>;
  /** Initially selected grouping dimension. */
  initialGroupBy: GroupByDimension;
  /** Called when a row is clicked to drill deeper. */
  onDrill: (dim: GroupByDimension, value: string, name: string) => void;
  reportTitle: string;
}

/**
 * Clickable breakdown list with a category-grouped dimension selector.
 * Grouping by a dimension already in `filters` is excluded from the selector;
 * clicking a row drills into that value.
 */
export function DimensionBreakdown({ filters, initialGroupBy, onDrill, reportTitle }: DimensionBreakdownProps) {
  const [groupBy, setGroupBy] = useState<GroupByDimension>(initialGroupBy);
  useEffect(() => setGroupBy(initialGroupBy), [initialGroupBy]);

  const categories = useMemo(() => getBreakdownCategories(filters), [filters]);
  const isEntity = ENTITY_DIMS.includes(groupBy);
  const dimLabel = DIM_LABEL[groupBy]?.toUpperCase();

  return (
    <div className="mt-8 border border-gray-200 rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-700">Desglose por dimensión</h3>
        <Select
          size="sm"
          variant="bordered"
          aria-label="Agrupar por"
          label="Agrupar por"
          selectedKeys={[groupBy]}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0] as GroupByDimension | undefined;
            if (key) setGroupBy(key);
          }}
          className="w-full sm:w-64"
          classNames={{ trigger: 'cursor-pointer' }}
        >
          {categories.map((cat) => (
            <SelectSection key={cat.id} title={cat.label} showDivider>
              {cat.dims.map((d) => (
                <SelectItem key={d.key} className="cursor-pointer">{d.label}</SelectItem>
              ))}
            </SelectSection>
          ))}
        </Select>
      </div>

      <AnalyticsListSection
        key={groupBy}
        groupBy={groupBy}
        filters={filters}
        showSearch
        hideBudgetColumns
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
