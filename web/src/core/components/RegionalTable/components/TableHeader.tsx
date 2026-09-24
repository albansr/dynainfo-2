import React, { memo } from 'react';
import type { ColumnDefinition, ColumnGroup } from '../config/types';
import type { TableConfig, SortKey, SortDirection } from '../types';

interface TableHeaderProps {
  columns: ColumnDefinition[];
  groups: ColumnGroup[];
  config: TableConfig;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}

export const TableHeader = memo(function TableHeader({
  columns,
  groups,
  config,
  sortKey,
  sortDirection,
  onSort,
}: TableHeaderProps) {
  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <span className="opacity-25" aria-hidden="true">⇅</span>;
    return sortDirection === 'asc' ? (
      <span className="text-zinc-700" aria-hidden="true">↑</span>
    ) : (
      <span className="text-zinc-700" aria-hidden="true">↓</span>
    );
  };

  const renderHeaderCell = (column: ColumnDefinition) => {
    const { header, sortable, sortKey: colSortKey } = column;
    const hasRowSpan = header.rowSpan && header.rowSpan > 1;

    const label = header.labelFormatter
      ? header.labelFormatter(config)
      : header.label;

    const isSortable = !!(sortable && colSortKey);
    const isActive = isSortable && sortKey === colSortKey;
    const ariaSort: React.AriaAttributes['aria-sort'] = isActive
      ? sortDirection === 'asc' ? 'ascending' : 'descending'
      : undefined;

    const className = `px-0 py-${hasRowSpan ? '3' : '2'} border-b border-r border-zinc-200`;
    const alignClass = column.align === 'left' ? 'ml-2 text-left' : 'mr-2 text-right';

    const inner = (
      <div className={`${alignClass} text-[10px] font-bold uppercase tracking-wide text-zinc-500`}>
        {label} {isSortable && getSortIcon(colSortKey as SortKey)}
      </div>
    );

    return (
      <th
        key={column.id}
        scope="col"
        aria-sort={ariaSort}
        className={className}
        rowSpan={header.rowSpan}
        colSpan={header.colSpan}
      >
        {isSortable ? (
          <button
            type="button"
            className="w-full cursor-pointer hover:text-zinc-700"
            onClick={() => onSort(colSortKey as SortKey)}
          >
            {inner}
          </button>
        ) : (
          inner
        )}
      </th>
    );
  };

  const renderGroupCell = (group: ColumnGroup) => {
    const groupColumns = columns.filter((col) => col.group === group.id);
    if (groupColumns.length === 0) return null;

    return (
      <th
        key={group.id}
        scope="colgroup"
        className="px-0 py-2 text-[8px] font-semibold uppercase tracking-wider text-zinc-400 text-center border-b border-r border-zinc-200"
        colSpan={groupColumns.length}
      >
        {group.label}
      </th>
    );
  };

  // Build first row respecting exact column order. Computed directly (not
  // memoized): a header row is a handful of cells and the render fns close over
  // props, so memoizing here is premature and the compiler can't preserve it.
  const firstRowElements: React.ReactElement[] = [];
  const processedGroups = new Set<string>();
  columns.forEach((col) => {
    if (col.header.rowSpan && col.header.rowSpan > 1) {
      // Column spans both rows - render directly
      firstRowElements.push(renderHeaderCell(col));
    } else if (col.group && !processedGroups.has(col.group)) {
      // First column of a new group - render group header
      const group = groups.find((g) => g.id === col.group);
      if (group) {
        const groupCell = renderGroupCell(group);
        if (groupCell) {
          firstRowElements.push(groupCell);
        }
        processedGroups.add(col.group);
      }
    }
  });

  // Columns in groups (appear in second row)
  const groupedColumns = columns.filter((col) => col.group);

  return (
    <thead style={{ backgroundColor: '#f3f3f3' }}>
      {/* Group row */}
      <tr>
        {firstRowElements}
      </tr>

      {/* Column row */}
      <tr>
        {groupedColumns.map((col) => renderHeaderCell(col))}
      </tr>
    </thead>
  );
});
