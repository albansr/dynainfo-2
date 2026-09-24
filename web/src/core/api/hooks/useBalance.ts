import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import { usesFacturadoOnly, type SalesMetricPreset } from '@/core/utils/salesMetric';
import { useMergedFilters } from './useMergedFilters';
import { appendFilterParams, type FilterMap } from '@/core/api/downloadExcel';
import type { BalanceSheetResponse, BalanceQueryParams } from '../types';

async function fetchBalance(
  params: BalanceQueryParams,
  facturadoOnly: boolean,
  filters?: FilterMap
): Promise<BalanceSheetResponse> {
  const q = new URLSearchParams();
  if (params.startDate) q.append('startDate', params.startDate);
  if (params.endDate) q.append('endDate', params.endDate);
  // Closed periods exclude comprometido from budget-relative metrics
  if (facturadoOnly) q.append('facturadoOnly', 'true');
  appendFilterParams(q, filters);

  const qs = q.toString();
  return apiClient<BalanceSheetResponse>(`/api/balance${qs ? `?${qs}` : ''}`);
}

export function useBalance(
  startDate: Date,
  endDate: Date,
  preset: SalesMetricPreset,
  filters?: FilterMap
) {
  const params: BalanceQueryParams = {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
  };
  const facturadoOnly = usesFacturadoOnly(preset);

  // Channel/scope roles get their data filtered automatically
  const mergedFilters = useMergedFilters(filters);

  return useQuery({
    queryKey: ['balance', params.startDate, params.endDate, facturadoOnly, mergedFilters],
    queryFn: () => fetchBalance(params, facturadoOnly, mergedFilters),
  });
}
