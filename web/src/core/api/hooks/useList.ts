import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';

export type GroupByDimension = 'seller_id' | 'IdRegional' | 'customer_id' | 'customer_name' | 'customer_country' | 'product_id' | 'ProveedorComercial' | 'Marca' | 'SegmentacionCliente' | 'SegmentacionProducto' | 'month' | 'quarter' | 'year';

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

  // Add dynamic filters
  for (const [key, value] of Object.entries(params)) {
    if (!['groupBy', 'startDate', 'endDate', 'page', 'limit', 'orderBy', 'orderDirection'].includes(key)) {
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
  startDate?: Date,
  endDate?: Date,
  filters?: Record<string, any>,
  page: number = 1,
  limit: number = 50
) {
  const params: ListQueryParams = {
    groupBy,
    ...(startDate && { startDate: format(startDate, 'yyyy-MM-dd') }),
    ...(endDate && { endDate: format(endDate, 'yyyy-MM-dd') }),
    page,
    limit,
    orderBy: 'sales',
    orderDirection: 'desc',
    ...filters,
  };

  return useQuery({
    queryKey: ['list', params.groupBy, params.startDate, params.endDate, page, limit, filters],
    queryFn: () => fetchList(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
