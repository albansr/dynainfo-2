import { useState, useMemo, useCallback } from 'react';
import type { RegionalData, SortKey, SortDirection } from '../types';
import type { ColumnDefinition } from '../config/types';

export function useSort(data: RegionalData[], columns: ColumnDefinition[]) {
  const [sortKey, setSortKey] = useState<SortKey | null>('sales');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return key;
      } else {
        setSortDirection('desc');
        return key;
      }
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    // Find the column with this sort key
    const column = columns.find((col) => col.sortKey === sortKey);
    if (!column) return data;

    const sorted = [...data].sort((a, b) => {
      const aValue = column.accessor(a);
      const bValue = column.accessor(b);

      // Handle different value types
      let aSort: any = aValue;
      let bSort: any = bValue;

      // For complex objects, extract sortable value
      if (typeof aValue === 'object' && aValue !== null) {
        // Use heuristic: if it has 'current', 'amount', or 'compliance', use that
        aSort = aValue.current ?? aValue.amount ?? aValue.compliance ?? 0;
        bSort = bValue.current ?? bValue.amount ?? bValue.compliance ?? 0;
      }

      // String comparison
      if (typeof aSort === 'string') {
        return sortDirection === 'asc'
          ? aSort.localeCompare(bSort as string)
          : (bSort as string).localeCompare(aSort);
      }

      // Numeric comparison
      return sortDirection === 'asc'
        ? (aSort as number) - (bSort as number)
        : (bSort as number) - (aSort as number);
    });

    return sorted;
  }, [data, sortKey, sortDirection, columns]);

  return { sortedData, sortKey, sortDirection, handleSort };
}
