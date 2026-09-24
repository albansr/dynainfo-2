import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import { useMergedFilters } from './useMergedFilters';
import { appendFilterParams, type FilterMap } from '@/core/api/downloadExcel';
import type { BalanceSeriesResponse } from '../types';

async function fetchBalanceSeries(
  startDate: string,
  endDate: string,
  granularity: 'day' | 'month',
  filters?: FilterMap
): Promise<BalanceSeriesResponse> {
  const q = new URLSearchParams({ startDate, endDate, granularity });
  appendFilterParams(q, filters);
  return apiClient<BalanceSeriesResponse>(`/api/balance/series?${q.toString()}`);
}

export function useBalanceSeries(
  startDate: Date,
  endDate: Date,
  granularity: 'day' | 'month',
  filters?: FilterMap
) {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  // Channel/scope roles get their series filtered automatically
  const mergedFilters = useMergedFilters(filters);

  return useQuery({
    queryKey: ['balance-series', start, end, granularity, mergedFilters],
    queryFn: () => fetchBalanceSeries(start, end, granularity, mergedFilters),
  });
}
