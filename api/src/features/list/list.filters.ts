import type { FilterCondition } from '../../core/db/clickhouse/query/interfaces.js';
import { sanitizeDateString, sanitizeFieldName } from '../../core/utils/sanitization.js';
import { parseQueryParamsToFilters } from '../balance/balance.schemas.js';
import { parseDynamicFilters, combineFilters } from '../../core/utils/filter-parser.js';

/**
 * Shared query-param parsing for the list endpoints.
 *
 * Extracts the groupBy/date/order sanitization plus dynamic-filter combining
 * used by both `/list` (paginated) and `/list/export` (full dataset). This is
 * pagination-agnostic: `page`/`limit` are handled by each route separately.
 */
export interface ParsedListQuery {
  groupBy: string;
  startDate?: string;
  endDate?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters: FilterCondition[];
}

export function parseListFilters(query: Record<string, unknown>): ParsedListQuery {
  const groupBy = sanitizeFieldName(String(query['groupBy']));
  const startDate = query['startDate'] ? sanitizeDateString(String(query['startDate'])) : undefined;
  const endDate = query['endDate'] ? sanitizeDateString(String(query['endDate'])) : undefined;
  const orderBy = query['orderBy'] ? sanitizeFieldName(String(query['orderBy'])) : undefined;
  const orderDirection = query['orderDirection'] === 'asc' ? 'asc' : query['orderDirection'] === 'desc' ? 'desc' : undefined;

  // Date filters from startDate/endDate
  const dateFilters = parseQueryParamsToFilters({
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  });

  // Dynamic filters from all other query params
  const dynamicFilters = parseDynamicFilters(query);

  const filters = combineFilters(dynamicFilters, dateFilters);

  return {
    groupBy,
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...(orderBy && { orderBy }),
    ...(orderDirection && { orderDirection }),
    filters,
  };
}
