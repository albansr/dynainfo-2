import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import { getSalesOrderByField, usesFacturadoOnly, type SalesMetricPreset } from '@/core/utils/salesMetric';
import { useAuthStore } from '@/core/store/authStore';
import { getRoleDataFilter } from '@/core/config/access';

export type GroupByDimension = 'seller_id' | 'IdRegional' | 'customer_id' | 'customer_name' | 'customer_country' | 'product_id' | 'ProveedorComercial' | 'Marca' | 'SegmentacionCliente' | 'SegmentacionProducto' | 'CentroOperaciones' | 'customer_city' | 'customer_department' | 'ClasifRiesgo' | 'Categoria' | 'SubCategoria' | 'FamiliaProducto' | 'Linea' | 'month' | 'quarter' | 'year';

export interface ListItemResponse {
  id: string;
  name: string;
  budget: number;
  budget_last_year: number;
  budget_vs_last_year: number;
  budget_cost: number;
  budget_cost_last_year: number;
  budget_cost_vs_last_year: number;
  sales: number;
  sales_last_year: number;
  sales_vs_last_year: number;
  gross_margin: number;
  gross_margin_last_year: number;
  gross_margin_vs_last_year: number;
  orders: number;
  orders_last_year: number;
  orders_vs_last_year: number;
  sales_total: number;
  sales_total_last_year: number;
  sales_total_vs_last_year: number;
  cartera: number;
  cartera_last_year: number;
  cartera_vs_last_year: number;
  sales_vs_budget: number;
  budget_achievement_pct: number;
  order_fulfillment_pct: number;
  gross_margin_pct: number;
  budget_gross_margin_pct: number;
  gross_margin_pct_last_year: number;
  gross_margin_pct_vs_last_year: number;
  cartera_compliance_pct: number;
}

export interface ListResponse {
  data: ListItemResponse[];
  meta: {
    groupBy: string;
    total: number;
    count: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ListQueryParams {
  groupBy: GroupByDimension;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  [key: string]: any;
}

async function fetchList(params: ListQueryParams): Promise<ListResponse> {
  const queryParams = new URLSearchParams();

  queryParams.append('groupBy', params.groupBy);

  if (params.startDate) {
    queryParams.append('startDate', params.startDate);
  }
  if (params.endDate) {
    queryParams.append('endDate', params.endDate);
  }
  if (params.page) {
    queryParams.append('page', params.page.toString());
  }
  if (params.limit) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params.orderBy) {
    queryParams.append('orderBy', params.orderBy);
  }
  if (params.orderDirection) {
    queryParams.append('orderDirection', params.orderDirection);
  }

  // Closed periods exclude comprometido from budget-relative metrics
  if (params.facturadoOnly) {
    queryParams.append('facturadoOnly', 'true');
  }

  // Case-insensitive search on the dimension id/name
  if (params.search) {
    queryParams.append('search', String(params.search));
  }

  // Add dynamic filters
  for (const [key, value] of Object.entries(params)) {
    if (!['groupBy', 'startDate', 'endDate', 'page', 'limit', 'orderBy', 'orderDirection', 'facturadoOnly', 'search'].includes(key)) {
      if (Array.isArray(value)) {
        // For arrays, append each value separately
        value.forEach(v => queryParams.append(key, String(v)));
      } else {
        queryParams.append(key, String(value));
      }
    }
  }

  const endpoint = `/api/list?${queryParams.toString()}`;
  return apiClient<ListResponse>(endpoint);
}

export function useList(
  groupBy: GroupByDimension,
  startDate: Date | undefined,
  endDate: Date | undefined,
  preset: SalesMetricPreset,
  filters?: Record<string, any>,
  page: number = 1,
  limit: number = 50,
  search?: string
) {
  // Channel roles get their data filtered by channel automatically
  const dynaRole = useAuthStore((s) => s.user?.dynaRole);
  const roleFilter = getRoleDataFilter(dynaRole);
  const mergedFilters = roleFilter ? { ...filters, ...roleFilter } : filters;
  const trimmedSearch = search?.trim() || undefined;

  const params: ListQueryParams = {
    groupBy,
    ...(startDate && { startDate: format(startDate, 'yyyy-MM-dd') }),
    ...(endDate && { endDate: format(endDate, 'yyyy-MM-dd') }),
    page,
    limit,
    orderBy: getSalesOrderByField(preset),
    orderDirection: 'desc',
    facturadoOnly: usesFacturadoOnly(preset),
    ...(trimmedSearch && { search: trimmedSearch }),
    ...mergedFilters,
  };

  return useQuery({
    queryKey: ['list', params.groupBy, params.startDate, params.endDate, page, limit, mergedFilters, preset, trimmedSearch],
    queryFn: () => fetchList(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
