import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { appendFilterParams } from '@/core/api/downloadExcel';
import { useMergedFilters } from '@/core/api/hooks/useMergedFilters';

/** Headline figures for the seller Estado page (one per insight card). */
export interface SellerStatus {
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
 * Fetch the seller Estado figures. The Estado page does NOT react to the global
 * temporality: each criterion has its own fixed rolling window, owned by the
 * backend. The hook only passes the seller scope filter (seller_id via the role).
 */
export function useSellerStatus() {
  const mergedFilters = useMergedFilters();

  const q = new URLSearchParams();
  appendFilterParams(q, mergedFilters);

  return useQuery({
    queryKey: ['seller-status', q.toString()],
    queryFn: () => apiClient<SellerStatus>(`/api/list/seller-status?${q.toString()}`),
  });
}
