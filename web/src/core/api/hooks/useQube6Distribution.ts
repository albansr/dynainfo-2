import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import type { Qube6DistributionResponse } from '../types';

async function fetchQube6Distribution(
  groupBy: string,
  startDate: string,
  endDate: string,
): Promise<Qube6DistributionResponse> {
  const params = new URLSearchParams({ groupBy, startDate, endDate });
  return apiClient<Qube6DistributionResponse>(`/api/qube6?${params.toString()}`);
}

export function useQube6Distribution(groupBy: string, startDate: Date, endDate: Date) {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['qube6-distribution', groupBy, start, end],
    queryFn: () => fetchQube6Distribution(groupBy, start, end),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
