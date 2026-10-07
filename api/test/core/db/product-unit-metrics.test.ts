import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClickHouseClient } from '@clickhouse/client';
import { AnalyticsQueryBuilder } from '../../../src/core/db/clickhouse/query/analytics-query-builder.js';
import { BALANCE_METRICS, PRODUCT_UNIT_METRICS } from '../../../src/core/config/metrics.config.js';

const COLUMNS: Record<string, string[]> = {
  dyna_transactions: ['date', 'product_id', 'product_name', 'sales_price', 'gross_margin', 'units', 'cost_price'],
  dyna_pedidos_retenidos: ['date', 'product_id', 'product_name', 'sales_price', 'cantidadComprometida', 'cost_price'],
  dyna_budget: ['date', 'product_id', 'product_name', 'sales_price', 'cost_price'],
  dyna_cartera: ['date', 'product_id', 'product_name', 'sales_price'],
};

function createMockClient(): ClickHouseClient {
  return {
    query: vi.fn().mockImplementation((config: { query: string }) => {
      if (config.query.includes('system.columns')) {
        const rows = Object.entries(COLUMNS).flatMap(([table, cols]) =>
          cols.map((column) => ({ table_name: table, column_name: column }))
        );
        return Promise.resolve({ json: vi.fn().mockResolvedValue(rows) });
      }
      return Promise.resolve({ json: vi.fn().mockResolvedValue([]) });
    }),
  } as unknown as ClickHouseClient;
}

/** The analytics SQL sent to ClickHouse (the last, non-discovery query). */
function analyticsSql(client: ClickHouseClient): string {
  const calls = vi.mocked(client.query).mock.calls;
  return (calls[calls.length - 1]![0] as { query: string }).query;
}

describe('product unit metrics (units + average unit cost)', () => {
  let client: ClickHouseClient;
  let builder: AnalyticsQueryBuilder;

  beforeEach(() => {
    process.env['TABLE_PREFIX'] = 'dyna_';
    client = createMockClient();
    builder = new AnalyticsQueryBuilder(client);
  });

  const filters = [
    { field: 'date', operator: 'gte' as const, value: '2026-09-01' },
    { field: 'date', operator: 'lte' as const, value: '2026-09-30' },
  ];

  it('sums invoiced units/cost and pending-order processed quantity/cost per product', async () => {
    await builder.buildGroupedMultiTableYoYQuery({
      metrics: [...BALANCE_METRICS, ...PRODUCT_UNIT_METRICS],
      currentPeriodFilters: filters,
      groupBy: 'product_id',
      orderBy: 'sales_total',
    });
    const sql = analyticsSql(client);

    expect(sql).toContain('sum(units) AS units');
    expect(sql).toContain('sum(cost_price) AS cost');
    expect(sql).toContain('sum(cantidadComprometida) AS orders_units');
    expect(sql).toContain('sum(cost_price) AS orders_cost');
    // Cartera stays in the query: the list response contract is unchanged.
    expect(sql).toContain('cartera_current');
  });

  it('derives units_total and both average unit costs with a divide-by-zero guard', async () => {
    await builder.buildGroupedMultiTableYoYQuery({
      metrics: [...BALANCE_METRICS, ...PRODUCT_UNIT_METRICS],
      currentPeriodFilters: filters,
      groupBy: 'product_id',
      orderBy: 'sales_total',
    });
    const sql = analyticsSql(client);

    expect(sql).toContain(
      'transactions_current.units + pedidos_retenidos_current.orders_units AS units_total'
    );
    expect(sql).toContain(
      'if(transactions_current.units != 0, transactions_current.cost / transactions_current.units, 0) AS avg_unit_cost'
    );
    expect(sql).toContain(
      'if((transactions_current.units + pedidos_retenidos_current.orders_units) != 0, ' +
        '(transactions_current.cost + pedidos_retenidos_current.orders_cost) / ' +
        '(transactions_current.units + pedidos_retenidos_current.orders_units), 0) AS avg_unit_cost_total'
    );
  });

  it('keeps the unit metrics out of queries that do not request them', async () => {
    await builder.buildGroupedMultiTableYoYQuery({
      metrics: BALANCE_METRICS,
      currentPeriodFilters: filters,
      groupBy: 'product_id',
      orderBy: 'sales_total',
    });
    const sql = analyticsSql(client);

    expect(sql).not.toContain('orders_units');
    expect(sql).not.toContain('AS units_total');
    expect(sql).not.toContain('avg_unit_cost');
  });
});
