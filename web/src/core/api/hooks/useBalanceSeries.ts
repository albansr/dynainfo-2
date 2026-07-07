import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import { useAuthStore } from '@/core/store/authStore';
import { getRoleDataFilter } from '@/core/config/access';
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

  // Channel roles get their series filtered by channel automatically
  const dynaRole = useAuthStore((s) => s.user?.dynaRole);
  const roleFilter = getRoleDataFilter(dynaRole);
  const mergedFilters = roleFilter ? { ...filters, ...roleFilter } : filters;

  return useQuery({
    queryKey: ['balance-series', start, end, granularity, mergedFilters],
    queryFn: () => fetchBalanceSeries(start, end, granularity, mergedFilters),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
