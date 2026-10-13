import type { IAnalyticsQueryBuilder, FilterCondition } from '../../core/db/clickhouse/query/interfaces.js';
import type {
  BalanceSheetResponse,
  BalanceQueryParams,
  BalanceReach,
} from './balance.schemas.js';
import { CUSTOMER_MASTER_TABLE } from '../../core/config/customer-master.config.js';
import { listActiveNonBuyers, type ActiveNonBuyer } from '../../core/utils/customer-master.js';
import { parseQueryParamsToFilters } from './balance.schemas.js';
import { BALANCE_METRICS, PRODUCT_UNIT_METRICS } from '../../core/config/metrics.config.js';
import { buildDynamicResponse } from '../../core/utils/response-builder.js';

/** Sales sources for the reach counts: invoiced + pending orders, or invoiced only for closed periods. */
function reachSources(field: string, facturadoOnly: boolean): Array<{ table: string; field: string }> {
  const tables = facturadoOnly ? ['transactions'] : ['transactions', 'pedidos_retenidos'];
  return tables.map((table) => ({ table, field }));
}

/**
 * Filters for the reach block: the period itself, the active-customer universe
 * narrowed by the board's filters, and whether the master covers the board.
 */
export interface ReachWindows {
  periodFilters: FilterCondition[];
  universeFilters: FilterCondition[];
  coversMaster: boolean;
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
   * Clientes sin compra, like Festival: active customers of the master who did
   * not buy in the period (same sources as Numérica). Null on boards the master
   * does not cover (Exportaciones, Cadenas, Retail).
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
      windows.coversMaster
        ? this.analyticsBuilder.buildDistinctCountExcludingQuery({
          universe: { table: CUSTOMER_MASTER_TABLE, field: 'customer_id', filters: windows.universeFilters },
          exclude: { sources: reachSources('customer_id', windows.facturadoOnly), filters: windows.periodFilters },
        })
        : null,
    ]);
    return {
      productos_unicos: productosUnicos,
      clientes_unicos: clientesUnicos,
      clientes_sin_compra: clientesSinCompra,
    };
  }

  /**
   * Detail of `clientes_sin_compra`: same universe and exclusion as getReach
   * (so the list length matches the card), with each customer's assigned seller.
   */
  async getSinCompraList(windows: ReachWindows): Promise<ActiveNonBuyer[]> {
    if (!windows.coversMaster) return [];
    return listActiveNonBuyers(this.analyticsBuilder, {
      universeFilters: windows.universeFilters,
      exclude: { sources: reachSources('customer_id', windows.facturadoOnly), filters: windows.periodFilters },
    });
  }
}
