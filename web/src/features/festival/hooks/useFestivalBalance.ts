import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '@/core/api/client';
import { useAuthStore } from '@/core/store/authStore';
import { getRoleDataFilter } from '@/core/config/access';

export interface FestivalBalance {
  sales_total: number;
  sales_total_compare: number;
  sales_total_growth: number | null;
  sales_total_growth_to_date: number | null;
  sales_total_compare_to_date: number | null;
  to_date_days: number;
  current_day: number;
  event_days: number;
  gross_margin: number;
  gross_margin_pct: number;
  gross_margin_pct_compare: number | null;
  gross_margin_pct_growth: number | null;
  rappel: number;
  rappel_pct: number;
  margen_rappel: number;
  margen_rappel_pct: number;
  margen_rappel_pct_compare: number | null;
  margen_rappel_pct_growth: number | null;
  margen_rappel_pct_growth_to_date: number | null;
  margen_rappel_pct_compare_to_date: number | null;
  comprometido: number;
  pedidos_count: number;
  pedido_promedio: number;
  pedido_promedio_compare: number | null;
  clientes_unicos: number;
  productos_unicos: number;
  /** Clientes activos con compra en el año del evento y sin compra durante el festival. */
  clientes_sin_compra: number;
  /** Null cuando los filtros activos no aplican al presupuesto. */
  presupuesto: number | null;
  cumplimiento_ppto: number | null;
}

export interface FestivalListRow {
  id: string;
  name: string;
  /** Código de artículo (IdItem), presente solo al agrupar por producto. */
  code?: string;
  sales_total: number;
  gross_margin_pct: number;
  rappel_pct: number;
  margen_rappel_pct: number;
  comprometido: number;
  pedido_promedio: number;
  /** Numérica: clientes únicos del grupo durante el evento. */
  clientes_unicos: number;
  /** Items: productos únicos del grupo durante el evento. */
  productos_unicos: number;
  /** Clientes activos con compra del grupo en el año y sin compra del grupo en el festival. */
  clientes_sin_compra: number;
  presupuesto: number | null;
  cumplimiento_ppto: number | null;
}

interface Wrapped<T> {
  data: T;
}

interface FestivalRange {
  startDate: Date;
  endDate: Date;
  /** Optional comparison window; omitted → no comparison. */
  compareStartDate?: Date;
  compareEndDate?: Date;
}

function buildParams(range: FestivalRange, filters?: Record<string, unknown>): string {
  const params = new URLSearchParams({
    startDate: format(range.startDate, 'yyyy-MM-dd'),
    endDate: format(range.endDate, 'yyyy-MM-dd'),
  });

  if (range.compareStartDate && range.compareEndDate) {
    params.set('compareStartDate', format(range.compareStartDate, 'yyyy-MM-dd'));
    params.set('compareEndDate', format(range.compareEndDate, 'yyyy-MM-dd'));
  }

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, String(v)));
      } else {
        params.append(key, String(value));
      }
    });
  }

  return params.toString();
}

/** Channel roles get their data filtered by channel automatically (parity with useBalance). */
export function useMergedFilters(filters?: Record<string, unknown>): Record<string, unknown> | undefined {
  const dynaRole = useAuthStore((s) => s.user?.dynaRole);
  const roleFilter = getRoleDataFilter(dynaRole);
  return roleFilter ? { ...filters, ...roleFilter } : filters;
}

function rangeKey(range: FestivalRange): string[] {
  return [
    format(range.startDate, 'yyyy-MM-dd'),
    format(range.endDate, 'yyyy-MM-dd'),
    range.compareStartDate ? format(range.compareStartDate, 'yyyy-MM-dd') : '',
    range.compareEndDate ? format(range.compareEndDate, 'yyyy-MM-dd') : '',
  ];
}

/** "En Vivo" dashboard: keep data fresh while the page stays open on screen. */
const LIVE_REFETCH_INTERVAL = 1000 * 60 * 2;

export function useFestivalBalance(range: FestivalRange, filters?: Record<string, unknown>) {
  const mergedFilters = useMergedFilters(filters);

  return useQuery({
    queryKey: ['festival-balance', ...rangeKey(range), mergedFilters],
    queryFn: () => apiClient<Wrapped<FestivalBalance>>(`/api/festival?${buildParams(range, mergedFilters)}`),
    staleTime: 1000 * 60 * 2,
    refetchInterval: LIVE_REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
  });
}

export interface FestivalSinCompraRow {
  customer_id: string;
  customer_name: string;
  seller_id: string;
  seller_name: string;
}

/**
 * Detail of the `clientes_sin_compra` metric (fetched on demand when the
 * modal opens). Same window/filters contract as the balance.
 */
export function useFestivalSinCompra(range: FestivalRange, filters: Record<string, unknown> | undefined, enabled: boolean) {
  const mergedFilters = useMergedFilters(filters);

  return useQuery({
    queryKey: ['festival-sin-compra', ...rangeKey(range), mergedFilters],
    queryFn: () => apiClient<Wrapped<FestivalSinCompraRow[]>>(`/api/festival/sin-compra?${buildParams(range, mergedFilters)}`),
    staleTime: 1000 * 60 * 2,
    enabled,
  });
}

export interface FestivalDailyPoint {
  period: string;
  sales_total: number;
}

/** Daily sales series (facturado + comprometido) over the event window. */
export function useFestivalDaily(range: FestivalRange, filters?: Record<string, unknown>) {
  const mergedFilters = useMergedFilters(filters);

  return useQuery({
    queryKey: ['festival-daily', ...rangeKey(range), mergedFilters],
    queryFn: () => apiClient<Wrapped<FestivalDailyPoint[]>>(`/api/festival/daily?${buildParams(range, mergedFilters)}`),
    staleTime: 1000 * 60 * 2,
    refetchInterval: LIVE_REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
  });
}

/** Festival listing grouped by `groupBy` (e.g. 'ProveedorComercial'). */
export function useFestivalList(range: FestivalRange, groupBy: string, filters?: Record<string, unknown>) {
  const mergedFilters = useMergedFilters(filters);
  const query = buildParams(range, mergedFilters) + `&groupBy=${encodeURIComponent(groupBy)}`;

  return useQuery({
    queryKey: ['festival-list', groupBy, ...rangeKey(range), mergedFilters],
    queryFn: () => apiClient<Wrapped<FestivalListRow[]>>(`/api/festival/list?${query}`),
    staleTime: 1000 * 60 * 2,
    refetchInterval: LIVE_REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
  });
}
