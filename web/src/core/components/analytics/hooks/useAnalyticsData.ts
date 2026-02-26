import { useBalance } from '@/core/api/hooks/useBalance';
import { useList } from '@/core/api/hooks/useList';
import type { GroupByDimension } from '../types';

/**
 * Generic hook for fetching analytics data
 * Combines balance (metrics) and list (table) data with optional filters
 *
 * @param groupBy - Dimension to group data by
 * @param startDate - Start date for data range
 * @param endDate - End date for data range
 * @param filters - Optional global filters applied to both metrics and table
 * @returns Combined data from useBalance and useList hooks
 *
 * @example
 * const { balanceData, listData, isLoading, error } = useAnalyticsData(
 *   'IdRegional',
 *   startDate,
 *   endDate,
 *   { type: 'export' }
 * );
 */
export function useAnalyticsData(
  groupBy: GroupByDimension,
  startDate: Date,
  endDate: Date,
  filters?: Record<string, any>
) {
  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useBalance(startDate, endDate, filters);

  const {
    data: listData,
    isLoading: isLoadingList,
    error: listError,
  } = useList(groupBy, startDate, endDate, filters);

  return {
    balanceData: balanceData?.data,
    listData: listData?.data || [],
    listMeta: listData?.meta,
    isLoading: isLoadingBalance || isLoadingList,
    error: balanceError || listError,
    isLoadingBalance,
    isLoadingList,
    balanceError,
    listError,
  };
}
