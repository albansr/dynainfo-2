import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsQueryBuilder } from '../../../src/core/db/clickhouse/query/analytics-query-builder.js';
import type { ClickHouseClient } from '@clickhouse/client';
import type { MetricConfig } from '../../../src/core/db/clickhouse/query/types.js';
import type { FilterCondition } from '../../../src/core/db/clickhouse/query/filter-builder.js';

// Mock ClickHouse client with comprehensive column set
function createMockClient() {
  return {
    query: vi.fn().mockImplementation((config: any) => {
      // If it's a column discovery query (system.columns)
      if (config.query?.includes('system.columns')) {
        return Promise.resolve({
          json: vi.fn().mockResolvedValue([
            // dyna_transactions columns
            { table_name: 'dyna_transactions', column_name: 'date' },
            { table_name: 'dyna_transactions', column_name: 'sales_price' },
            { table_name: 'dyna_transactions', column_name: 'seller_id' },
            { table_name: 'dyna_transactions', column_name: 'IdRegional' },
            // dyna_budget columns
            { table_name: 'dyna_budget', column_name: 'date' },
            { table_name: 'dyna_budget', column_name: 'sales_price' },
            { table_name: 'dyna_budget', column_name: 'amount' },
            { table_name: 'dyna_budget', column_name: 'IdRegional' },
            // dyna_pedidos_retenidos (orders) columns
            { table_name: 'dyna_pedidos_retenidos', column_name: 'date' },
            { table_name: 'dyna_pedidos_retenidos', column_name: 'order_count' },
            { table_name: 'dyna_pedidos_retenidos', column_name: 'sales_price' },
            { table_name: 'dyna_pedidos_retenidos', column_name: 'IdRegional' },
          ]),
        });
      }
      // Otherwise, it's the actual analytics query (to be mocked per test)
      return Promise.resolve({
        json: vi.fn().mockResolvedValue([]),
      });
    }),
  } as unknown as ClickHouseClient;
}

describe('AnalyticsQueryBuilder', () => {
  let mockClient: ClickHouseClient;
  let builder: AnalyticsQueryBuilder;

  beforeEach(() => {
    mockClient = createMockClient();
    builder = new AnalyticsQueryBuilder(mockClient);
    vi.clearAllMocks();
    process.env['TABLE_PREFIX'] = 'dyna_';
  });

  describe('buildMultiTableYoYQuery', () => {
    it('should execute query with correct structure', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([
          {
            sales: 10000,
            sales_ly: 8000,
            sales_vs_last_year: 25.0,
          },
        ]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-12-01' },
        { field: 'date', operator: 'lte', value: '2025-12-31' },
      ];

      const result = await builder.buildMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: filters,
      });

      expect(result).toEqual({
        sales: 10000,
        sales_ly: 8000,
        sales_vs_last_year: 25.0,
      });

      // Verify query was called with parameterized values
      expect(mockClient.query).toHaveBeenCalledWith({
        query: expect.stringContaining('WITH'),
        query_params: expect.any(Object),
        format: 'JSONEachRow',
      });
    });

    it('should handle multiple metrics from different tables', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([
          {
            sales: 10000,
            sales_ly: 8000,
            sales_vs_last_year: 25.0,
            budget: 9000,
            budget_ly: 8500,
            budget_vs_last_year: 5.88,
            orders: 11000,
            orders_ly: 9000,
            orders_vs_last_year: 22.22,
          },
        ]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
        {
          table: 'budget',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'budget',
        },
        {
          table: 'pedidos_retenidos',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'orders',
        },
      ];

      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
      ];

      const result = await builder.buildMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: filters,
      });

      expect(result.sales).toBe(10000);
      expect(result.budget).toBe(9000);
      expect(result.orders).toBe(11000);
    });

    it('should use parameterized queries to prevent SQL injection', async () => {
      // Mock both column discovery and analytics query
      vi.mocked(mockClient.query).mockImplementation((config: any) => {
        if (config.query?.includes('system.columns')) {
          return Promise.resolve({
            json: vi.fn().mockResolvedValue([
              { table_name: 'dyna_transactions', column_name: 'date' },
              { table_name: 'dyna_transactions', column_name: 'sales_price' },
              { table_name: 'dyna_transactions', column_name: 'seller_id' },
            ]),
          } as any);
        }
        return Promise.resolve({
          json: vi.fn().mockResolvedValue([{ sales: 5000 }]),
        } as any);
      });

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
        { field: 'seller_id', operator: 'in', value: ['S001', 'S002'] },
      ];

      await builder.buildMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: filters,
      });

      // Second call is the actual analytics query (first is column discovery)
      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      // Verify that query uses parameter placeholders
      expect(callArgs.query).toContain('{current_transactions_date_0:String}');
      expect(callArgs.query).toContain('{current_transactions_seller_id_1:Array(String)}');

      // Verify that actual values are in query_params
      expect(callArgs.query_params).toHaveProperty('current_transactions_date_0', '2025-01-01');
      expect(callArgs.query_params).toHaveProperty('current_transactions_seller_id_1', ['S001', 'S002']);
    });

    it('should reject invalid field names', async () => {
      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      // Use invalid field name (SQL injection attempt)
      const filters: FilterCondition[] = [
        { field: 'date; DROP TABLE users;', operator: 'gte', value: '2025-01-01' },
      ];

      await expect(
        builder.buildMultiTableYoYQuery({
          metrics,
          currentPeriodFilters: filters,
        })
      ).rejects.toThrow('Invalid field name');
    });

    it('should handle empty result set', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      const result = await builder.buildMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
      });

      expect(result).toEqual({});
    });

    it('should support different aggregation functions', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([
          {
            total_sum: 10000,
            avg_price: 250,
            count_items: 40,
          },
        ]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'total_sum',
        },
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'avg',
          alias: 'avg_price',
        },
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'count',
          alias: 'count_items',
        },
      ];

      await builder.buildMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];
      expect(callArgs.query).toContain('sum(sales_price)');
      expect(callArgs.query).toContain('avg(sales_price)');
      expect(callArgs.query).toContain('count(sales_price)');
    });

    it('should properly shift dates for previous year filters', async () => {
      // Mock both column discovery and analytics query
      vi.mocked(mockClient.query).mockImplementation((config: any) => {
        if (config.query?.includes('system.columns')) {
          return Promise.resolve({
            json: vi.fn().mockResolvedValue([
              { table_name: 'dyna_transactions', column_name: 'date' },
              { table_name: 'dyna_transactions', column_name: 'sales_price' },
            ]),
          } as any);
        }
        return Promise.resolve({
          json: vi.fn().mockResolvedValue([
            {
              sales: 10000,
              sales_ly: 8000,
            },
          ]),
        } as any);
      });

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-12-01' },
        { field: 'date', operator: 'lte', value: '2025-12-31' },
      ];

      await builder.buildMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: filters,
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      // Check that previous year dates are shifted by 1 year (now includes table name in param)
      expect(callArgs.query_params).toHaveProperty('previous_transactions_date_0', '2024-12-01');
      expect(callArgs.query_params).toHaveProperty('previous_transactions_date_1', '2024-12-31');
    });

    it('should always put transactions table first in generated SQL', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([
          {
            budget: 9000,
            sales: 10000,
            orders: 11000,
          },
        ]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      // Intentionally put transactions NOT first in the array
      const metrics: MetricConfig[] = [
        {
          table: 'budget',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'budget',
        },
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
        {
          table: 'pedidos_retenidos',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'orders',
        },
      ];

      await builder.buildMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];
      const query = callArgs.query;

      // Find positions of CTEs in the query
      const transactionsPos = query.indexOf('transactions_current AS');
      const budgetPos = query.indexOf('budget_current AS');
      const ordersPos = query.indexOf('pedidos_retenidos_current AS');

      // transactions should come before budget and orders
      expect(transactionsPos).toBeLessThan(budgetPos);
      expect(transactionsPos).toBeLessThan(ordersPos);
    });
  });

  describe('buildGroupedMultiTableYoYQuery', () => {
    it('should execute query with pagination parameters', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([
          {
            name: 'Region A',
            _total_count: 100,
            sales: 10000,
            sales_ly: 8000,
            sales_vs_last_year: 25.0,
          },
        ]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
      ];

      await builder.buildGroupedMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: filters,
        groupBy: 'seller_id',
        limit: 50,
        offset: 100,
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      // Verify pagination clause
      expect(callArgs.query).toContain('LIMIT 50 OFFSET 100');

      // Verify window function for total count
      expect(callArgs.query).toContain('count() OVER ()');
      expect(callArgs.query).toContain('_total_count');
    });

    it('should not include pagination when limit is undefined', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([
          {
            name: 'Region A',
            sales: 10000,
            sales_ly: 8000,
            sales_vs_last_year: 25.0,
          },
        ]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      await builder.buildGroupedMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
        groupBy: 'seller_id',
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      // Should not have LIMIT clause
      expect(callArgs.query).not.toContain('LIMIT');

      // Should not have window function
      expect(callArgs.query).not.toContain('count() OVER ()');
      expect(callArgs.query).not.toContain('_total_count');
    });

    it('should include pagination with limit but no offset', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      await builder.buildGroupedMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
        groupBy: 'seller_id',
        limit: 20,
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      // Should have LIMIT without OFFSET
      expect(callArgs.query).toContain('LIMIT 20');
      expect(callArgs.query).not.toContain('OFFSET');
    });

    it('should include both limit and offset when provided', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      await builder.buildGroupedMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
        groupBy: 'seller_id',
        limit: 20,
        offset: 40,
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      // Should have both LIMIT and OFFSET
      expect(callArgs.query).toContain('LIMIT 20 OFFSET 40');
    });

    it('should use trimBoth for groupBy field', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      await builder.buildGroupedMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
        groupBy: 'seller_id',
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      // Should use trimBoth to normalize whitespace
      expect(callArgs.query).toContain('trimBoth(seller_id)');
      expect(callArgs.query).toContain('GROUP BY 1');
    });

    it('should use LEFT JOIN strategy from transactions_current', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
        {
          table: 'budget',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'budget',
        },
      ];

      await builder.buildGroupedMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
        groupBy: 'seller_id',
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      // Should start from transactions_current
      expect(callArgs.query).toContain('FROM transactions_current');

      // Should use LEFT JOIN (not FULL OUTER JOIN)
      expect(callArgs.query).toContain('LEFT JOIN');
      expect(callArgs.query).not.toContain('FULL OUTER JOIN');

      // Should join other tables to transactions_current
      expect(callArgs.query).toContain('LEFT JOIN transactions_previous');
      expect(callArgs.query).toContain('LEFT JOIN budget_current');
      expect(callArgs.query).toContain('LEFT JOIN budget_previous');
    });

    it('should order results by sales DESC by default', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      await builder.buildGroupedMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
        groupBy: 'seller_id',
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      // Should order by sales DESC by default
      expect(callArgs.query).toContain('ORDER BY sales DESC');
    });

    it('should order by specified field and direction', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      await builder.buildGroupedMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
        groupBy: 'seller_id',
        orderBy: 'name',
        orderDirection: 'asc',
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      expect(callArgs.query).toContain('ORDER BY name ASC');
    });

    it('should order by calculated metrics', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
        {
          table: 'budget',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'budget',
        },
      ];

      await builder.buildGroupedMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
        groupBy: 'seller_id',
        orderBy: 'sales_vs_budget',
        orderDirection: 'desc',
      });

      // Last call is the main query (previous calls are for column discovery)
      const calls = vi.mocked(mockClient.query).mock.calls;
      const callArgs = calls[calls.length - 1][0];

      expect(callArgs.query).toContain('ORDER BY sales_vs_budget DESC');
    });

    it('should reject invalid orderBy field', async () => {
      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      await expect(
        builder.buildGroupedMultiTableYoYQuery({
          metrics,
          currentPeriodFilters: [],
          groupBy: 'seller_id',
          orderBy: 'invalid_field',
          orderDirection: 'desc',
        })
      ).rejects.toThrow('Invalid orderBy field');
    });

    it('should reject invalid orderDirection', async () => {
      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      await expect(
        builder.buildGroupedMultiTableYoYQuery({
          metrics,
          currentPeriodFilters: [],
          groupBy: 'seller_id',
          orderBy: 'sales',
          orderDirection: 'invalid' as any,
        })
      ).rejects.toThrow('Invalid orderDirection');
    });

    it('should normalize orderDirection to uppercase in SQL', async () => {
      const mockResultSet = {
        json: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(mockClient.query).mockResolvedValue(mockResultSet as any);

      const metrics: MetricConfig[] = [
        {
          table: 'transactions',
          field: 'sales_price',
          aggregation: 'sum',
          alias: 'sales',
        },
      ];

      await builder.buildGroupedMultiTableYoYQuery({
        metrics,
        currentPeriodFilters: [],
        groupBy: 'seller_id',
        orderBy: 'sales',
        orderDirection: 'asc',
      });

      const callArgs = vi.mocked(mockClient.query).mock.calls[1][0];

      // Should be uppercase in SQL
      expect(callArgs.query).toContain('ORDER BY sales ASC');
      expect(callArgs.query).not.toContain('ORDER BY sales asc');
    });
  });
});
