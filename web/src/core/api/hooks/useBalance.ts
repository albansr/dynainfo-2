import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import { usesFacturadoOnly, type SalesMetricPreset } from '@/core/utils/salesMetric';
import type { BalanceSheetResponse, BalanceQueryParams } from '../types';

async function fetchBalance(
  params: BalanceQueryParams,
  facturadoOnly: boolean,
  filters?: Record<string, any>
): Promise<BalanceSheetResponse> {
  const queryParams = new URLSearchParams();

  if (params.startDate) {
    queryParams.append('startDate', params.startDate);
  }

  if (params.endDate) {
    queryParams.append('endDate', params.endDate);
  }

  // Closed periods exclude comprometido from budget-relative metrics
  if (facturadoOnly) {
    queryParams.append('facturadoOnly', 'true');
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

export function useBalance(
  startDate: Date,
  endDate: Date,
  preset: SalesMetricPreset,
  filters?: Record<string, any>
) {
  const params: BalanceQueryParams = {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
  };
  const facturadoOnly = usesFacturadoOnly(preset);

  return useQuery({
    queryKey: ['balance', params.startDate, params.endDate, facturadoOnly, filters],
    queryFn: () => fetchBalance(params, facturadoOnly, filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
