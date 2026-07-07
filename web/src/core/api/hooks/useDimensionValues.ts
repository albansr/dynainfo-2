import { useMemo } from 'react';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useList, type GroupByDimension } from './useList';

export interface DimensionValue {
  id: string;
  name: string;
}

/**
 * Distinct values (id + name) of a dimension for the faceted filter multiselect.
 * Reuses the grouped list endpoint: it returns { id, name } per value, already
 * scoped by the context filters (e.g. channel) and searchable server-side, and
 * ordered by sales so the most relevant values come first.
 *
 * Mount this hook only while the value picker is open (fetches on mount).
 */
export function useDimensionValues(
  dimension: GroupByDimension,
  contextFilters: Record<string, any> | undefined,
  search: string
) {
  const { startDate, endDate, preset } = useDateRange();

  const query = useList(dimension, startDate, endDate, preset, contextFilters, 1, 100, search);

  const values: DimensionValue[] = useMemo(
    () => (query.data?.data ?? []).map((r) => ({ id: r.id, name: r.name })),
    [query.data]
  );

  return { values, isLoading: query.isLoading };
}
