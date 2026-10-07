import type { IAnalyticsQueryBuilder, FilterCondition } from '../../core/db/clickhouse/query/interfaces.js';
import type {
  BalanceSheetResponse,
  BalanceQueryParams,
  BalanceReach,
} from './balance.schemas.js';
import type { FestivalSinCompraRow } from '../festival/festival.schemas.js';
import { parseQueryParamsToFilters } from './balance.schemas.js';
import { BALANCE_METRICS, PRODUCT_UNIT_METRICS } from '../../core/config/metrics.config.js';
import { buildDynamicResponse } from '../../core/utils/response-builder.js';

/** Sales sources for the reach counts: invoiced + pending orders, or invoiced only for closed periods. */
function reachSources(field: string, facturadoOnly: boolean): Array<{ table: string; field: string }> {
  const tables = facturadoOnly ? ['transactions'] : ['transactions', 'pedidos_retenidos'];
  return tables.map((table) => ({ table, field }));
}

/** Customer universe for "clientes sin compra": who bought (invoiced) in the history window. */
const HISTORY_TABLE = 'transactions';

/**
 * The 12 months before a period starting on `startDate` (YYYY-MM-DD):
 * [startDate − 12 months, startDate − 1 day]. Plain UTC date math.
 */
export function historyWindow(startDate: string): { startDate: string; endDate: string } {
  const [year = 0, month = 1, day = 1] = startDate.split('-').map(Number);
  const from = new Date(Date.UTC(year - 1, month - 1, day));
  const to = new Date(Date.UTC(year, month - 1, day - 1));
  return { startDate: from.toISOString().slice(0, 10), endDate: to.toISOString().slice(0, 10) };
}

/** Filters for the reach block: the period itself and the 12 months before it. */
export interface ReachWindows {
  periodFilters: FilterCondition[];
  historyFilters: FilterCondition[];
  facturadoOnly: boolean;
}

/**
 * Service for balance sheet business logic
 * Uses single optimized query with CTEs for maximum performance
 *
 * To add new metrics: Just add them to BALANCE_METRICS in metrics.config.ts
 * Everything else is handled automatically!
 *
 * Uses dependency injection for testability and loose coupling
 */
export class BalanceService {
  constructor(private analyticsBuilder: IAnalyticsQueryBuilder) {}

  /**
   * Get time-series sales data grouped by day or month
   */
  async getBalanceSeries(params: {
    filters: FilterCondition[];
    granularity: 'day' | 'month';
  }): Promise<Array<{ period: string; sales: number; budget: number }>> {
    return this.analyticsBuilder.buildTimeSeriesQuery(params);
  }

  /**
   * Get complete balance sheet (single raw object)
   * Single optimized query - all calculations in ClickHouse
   * Response is dynamically built from metrics configuration
   *
   * Accepts filters directly or via params for backward compatibility
   */
  async getBalanceSheet(
    params: (BalanceQueryParams | { filters: FilterCondition[] }) & {
      facturadoOnly?: boolean;
      /** Also aggregate units and cost (product listings' totals row). */
      includeUnits?: boolean;
    }
  ): Promise<BalanceSheetResponse> {
    // Support both filter formats: direct filters or params to parse
    const filters = 'filters' in params
      ? params.filters
      : parseQueryParamsToFilters(params);

    const extraMetrics = params.includeUnits ? PRODUCT_UNIT_METRICS : [];

    // Execute single query with all metrics and YoY comparison
    const result = await this.analyticsBuilder.buildMultiTableYoYQuery({
      metrics: [...BALANCE_METRICS, ...extraMetrics],
      currentPeriodFilters: filters,
      facturadoOnly: params.facturadoOnly ?? false,
    });

    // Build response using shared utility
    return buildDynamicResponse(result, extraMetrics);
  }

  /**
   * Reach block for the period: Items (distinct products), Numérica (distinct
   * customers) — both deduped between invoiced and pending orders — and
   * Clientes sin compra: customers who bought in the 12 months before the
   * period and not in it, within the same dashboard filters.
   */
  async getReach(windows: ReachWindows): Promise<BalanceReach> {
    const [clientesUnicos, productosUnicos, clientesSinCompra] = await Promise.all([
      this.analyticsBuilder.buildDistinctCountQuery({
        sources: reachSources('customer_id', windows.facturadoOnly),
        filters: windows.periodFilters,
      }),
      this.analyticsBuilder.buildDistinctCountQuery({
        sources: reachSources('product_id', windows.facturadoOnly),
        filters: windows.periodFilters,
      }),
      this.analyticsBuilder.buildDistinctCountExcludingQuery({
        universe: { table: HISTORY_TABLE, field: 'customer_id', filters: windows.historyFilters },
        exclude: { sources: reachSources('customer_id', windows.facturadoOnly), filters: windows.periodFilters },
      }),
    ]);
    return {
      productos_unicos: productosUnicos,
      clientes_unicos: clientesUnicos,
      clientes_sin_compra: clientesSinCompra,
    };
  }

  /**
   * Detail of `clientes_sin_compra`: same universe and exclusion as getReach
   * (so the list length matches the card), with the name and the seller of
   * each customer's latest purchase in the history window.
   */
  async getSinCompraList(windows: ReachWindows): Promise<FestivalSinCompraRow[]> {
    const rows = await this.analyticsBuilder.buildDistinctDetailsExcludingQuery({
      universe: { table: HISTORY_TABLE, keyField: 'customer_id', filters: windows.historyFilters },
      attributes: ['customer_name', 'seller_id', 'seller_name'],
      dateField: 'date',
      exclude: { sources: reachSources('customer_id', windows.facturadoOnly), filters: windows.periodFilters },
      orderBy: 'customer_name',
    });
    return rows.map((r) => ({
      customer_id: String(r['customer_id'] ?? ''),
      customer_name: String(r['customer_name'] ?? ''),
      seller_id: String(r['seller_id'] ?? ''),
      seller_name: String(r['seller_name'] ?? ''),
    }));
  }
}
