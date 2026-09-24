import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import { useMergedFilters } from './useMergedFilters';
import { appendFilterParams, type FilterMap } from '@/core/api/downloadExcel';
import type { Qube6DistributionResponse } from '../types';

async function fetchQube6Distribution(
  groupBy: string,
  startDate: string,
  endDate: string,
  filters?: FilterMap,
): Promise<Qube6DistributionResponse> {
  const q = new URLSearchParams({ groupBy, startDate, endDate });
  appendFilterParams(q, filters);
  return apiClient<Qube6DistributionResponse>(`/api/qube6?${q.toString()}`);
}

export function useQube6Distribution(
  groupBy: string,
  startDate: Date,
  endDate: Date,
  filters?: FilterMap,
) {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  // Channel/scope roles get their data filtered automatically
  const mergedFilters = useMergedFilters(filters);

  return useQuery({
    queryKey: ['qube6-distribution', groupBy, start, end, mergedFilters],
    queryFn: () => fetchQube6Distribution(groupBy, start, end, mergedFilters),
  });
}
