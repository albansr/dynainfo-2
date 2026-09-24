import { useState, useMemo, useCallback } from 'react';
import type { RegionalData, SortKey, SortDirection } from '../types';
import type { ColumnDefinition } from '../config/types';

export function useSort(data: RegionalData[], columns: ColumnDefinition[]) {
  const [sortKey, setSortKey] = useState<SortKey | null>('sales');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Note: keep the two setters independent (not nested). Nesting a
  // side-effectful setter inside another setter's updater double-fires the
  // toggle under React StrictMode, cancelling the direction change.
  const handleSort = useCallback((key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  }, [sortKey]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    // Find the column with this sort key
    const column = columns.find((col) => col.sortKey === sortKey);
    if (!column) return data;

    // Extract a sortable primitive: for metric objects use current/amount/compliance.
    const toSortable = (v: unknown): number | string => {
      if (typeof v === 'object' && v !== null) {
        const o = v as { current?: number; amount?: number; compliance?: number };
        return o.current ?? o.amount ?? o.compliance ?? 0;
      }
      return typeof v === 'string' ? v : Number(v) || 0;
    };

    const sorted = [...data].sort((a, b) => {
      const aSort = toSortable(column.accessor(a));
      const bSort = toSortable(column.accessor(b));

      if (typeof aSort === 'string' && typeof bSort === 'string') {
        return sortDirection === 'asc' ? aSort.localeCompare(bSort) : bSort.localeCompare(aSort);
      }

      return sortDirection === 'asc'
        ? Number(aSort) - Number(bSort)
        : Number(bSort) - Number(aSort);
    });

    return sorted;
  }, [data, sortKey, sortDirection, columns]);

  return { sortedData, sortKey, sortDirection, handleSort };
}
