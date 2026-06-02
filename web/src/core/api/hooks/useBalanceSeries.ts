import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import type { BalanceSeriesResponse } from '../types';

async function fetchBalanceSeries(
  startDate: string,
  endDate: string,
  granularity: 'day' | 'month',
  filters?: Record<string, string>
): Promise<BalanceSeriesResponse> {
  const queryParams = new URLSearchParams({ startDate, endDate, granularity });

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => queryParams.append(key, value));
  }

  return apiClient<BalanceSeriesResponse>(`/api/balance/series?${queryParams.toString()}`);
}

export function useBalanceSeries(
  startDate: Date,
  endDate: Date,
  granularity: 'day' | 'month',
  filters?: Record<string, string>
) {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['balance-series', start, end, granularity, filters],
    queryFn: () => fetchBalanceSeries(start, end, granularity, filters),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
