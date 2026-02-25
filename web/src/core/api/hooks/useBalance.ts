import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import type { BalanceSheetResponse, BalanceQueryParams } from '../types';

async function fetchBalance(params: BalanceQueryParams, filters?: Record<string, string>): Promise<BalanceSheetResponse> {
  const queryParams = new URLSearchParams();

  if (params.startDate) {
    queryParams.append('startDate', params.startDate);
  }

  if (params.endDate) {
    queryParams.append('endDate', params.endDate);
  }

  // Add additional filters
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      queryParams.append(key, value);
    });
  }

  const endpoint = `/api/balance${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiClient<BalanceSheetResponse>(endpoint);
}

export function useBalance(startDate: Date, endDate: Date, filters?: Record<string, string>) {
  const params: BalanceQueryParams = {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
  };

  return useQuery({
    queryKey: ['balance', params.startDate, params.endDate, filters],
    queryFn: () => fetchBalance(params, filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
