import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import { useAuthStore } from '@/core/store/authStore';
import { getRoleDataFilter } from '@/core/config/access';
import type { Qube6DistributionResponse } from '../types';

async function fetchQube6Distribution(
  groupBy: string,
  startDate: string,
  endDate: string,
  filters?: Record<string, any>,
): Promise<Qube6DistributionResponse> {
  const params = new URLSearchParams({ groupBy, startDate, endDate });
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, String(v)));
      } else if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
  }
  return apiClient<Qube6DistributionResponse>(`/api/qube6?${params.toString()}`);
}

export function useQube6Distribution(
  groupBy: string,
  startDate: Date,
  endDate: Date,
  filters?: Record<string, any>,
) {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  // Channel roles get their data filtered by channel automatically
  const dynaRole = useAuthStore((s) => s.user?.dynaRole);
  const roleFilter = getRoleDataFilter(dynaRole);
  const mergedFilters = roleFilter ? { ...filters, ...roleFilter } : filters;

  return useQuery({
    queryKey: ['qube6-distribution', groupBy, start, end, mergedFilters],
    queryFn: () => fetchQube6Distribution(groupBy, start, end, mergedFilters),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
