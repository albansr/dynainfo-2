import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '@/core/api/client';
import { appendFilterParams } from '@/core/api/downloadExcel';
import { useMergedFilters } from '@/core/api/hooks/useMergedFilters';
import { useDateRange } from '@/core/hooks/useDateRange';
import { usesFacturadoOnly } from '@/core/utils/salesMetric';

/** Headline counts for the seller Estado page (one per insight card). */
export interface SellerStatus {
  numerica: number;
  sinCompra: number;
  riesgo: number;
  riesgoSales: number;
  riesgoMarginPct: number;
  promesa: number;
  promesaSales: number;
  promesaMarginPct: number;
  pesoTotal: number;
  pesoRetrocediendo: number;
  pesoDecline: number;
  pesoDeclineSharePct: number;
}

/**
 * Fetch the seller Estado counts for the active window. The seller scope filter
 * (seller_id via the role) is merged in automatically, like every other query.
 */
export function useSellerStatus() {
  const { startDate, endDate, preset } = useDateRange();
  const mergedFilters = useMergedFilters();

  const q = new URLSearchParams();
  if (startDate) q.append('startDate', format(startDate, 'yyyy-MM-dd'));
  if (endDate) q.append('endDate', format(endDate, 'yyyy-MM-dd'));
  if (usesFacturadoOnly(preset)) q.append('facturadoOnly', 'true');
  appendFilterParams(q, mergedFilters);

  return useQuery({
    queryKey: ['seller-status', q.toString()],
    queryFn: () => apiClient<SellerStatus>(`/api/list/seller-status?${q.toString()}`),
  });
}
