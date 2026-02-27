import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import type { BalanceSheetResponse, BalanceQueryParams } from '../types';

async function fetchBalance(params: BalanceQueryParams, filters?: Record<string, any>): Promise<BalanceSheetResponse> {
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
      if (Array.isArray(value)) {
        // For arrays, append each value separately
        value.forEach(v => queryParams.append(key, String(v)));
      } else {
        queryParams.append(key, String(value));
      }
    });
  }

  const endpoint = `/api/balance${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiClient<BalanceSheetResponse>(endpoint);
}

export function useBalance(startDate: Date, endDate: Date, filters?: Record<string, any>) {
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
