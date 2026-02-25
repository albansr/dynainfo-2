import React, { memo, useMemo } from 'react';
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
    if (sortKey !== key) return <span className="opacity-25">⇅</span>;
    return sortDirection === 'asc' ? (
      <span className="text-zinc-700">↑</span>
    ) : (
      <span className="text-zinc-700">↓</span>
    );
  };

  const renderHeaderCell = (column: ColumnDefinition) => {
    const { header, sortable, sortKey: colSortKey } = column;
    const hasRowSpan = header.rowSpan && header.rowSpan > 1;

    const label = header.labelFormatter
      ? header.labelFormatter(config)
      : header.label;

    const className = `px-0 py-${hasRowSpan ? '3' : '2'} border-b border-r border-zinc-200 ${
      sortable ? 'cursor-pointer hover:text-zinc-700' : ''
    }`;

    const alignClass = column.align === 'left' ? 'ml-2 text-left' : 'mr-2 text-right';

    return (
      <th
        key={column.id}
        className={className}
        rowSpan={header.rowSpan}
        colSpan={header.colSpan}
        onClick={() => sortable && colSortKey && onSort(colSortKey as SortKey)}
      >
        <div className={`${alignClass} text-[10px] font-bold uppercase tracking-wide text-zinc-500`}>
          {label} {sortable && colSortKey && getSortIcon(colSortKey as SortKey)}
        </div>
      </th>
    );
  };

  const renderGroupCell = (group: ColumnGroup) => {
    const groupColumns = columns.filter((col) => col.group === group.id);
    if (groupColumns.length === 0) return null;

    return (
      <th
        key={group.id}
        className="px-0 py-2 text-[8px] font-semibold uppercase tracking-wider text-zinc-400 text-center border-b border-r border-zinc-200"
        colSpan={groupColumns.length}
      >
        {group.label}
      </th>
    );
  };

  // Build first row respecting exact column order
  const firstRowElements = useMemo(() => {
    const elements: React.ReactElement[] = [];
    const processedGroups = new Set<string>();

    columns.forEach((col) => {
      if (col.header.rowSpan && col.header.rowSpan > 1) {
        // Column spans both rows - render directly
        elements.push(renderHeaderCell(col));
      } else if (col.group && !processedGroups.has(col.group)) {
        // First column of a new group - render group header
        const group = groups.find((g) => g.id === col.group);
        if (group) {
          const groupCell = renderGroupCell(group);
          if (groupCell) {
            elements.push(groupCell);
          }
          processedGroups.add(col.group);
        }
      }
    });

    return elements;
  }, [columns, groups]);

  // Columns in groups (appear in second row)
  const groupedColumns = useMemo(
    () => columns.filter((col) => col.group),
    [columns]
  );

  return (
    <thead style={{ backgroundColor: '#f8f8f8' }}>
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
