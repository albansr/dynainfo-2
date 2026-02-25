import { describe, it, expect, beforeEach } from 'vitest';
import { CTEBuilder } from '../../../src/core/db/clickhouse/query/cte-builder.js';
import type { MetricConfig } from '../../../src/core/db/clickhouse/query/types.js';

describe('CTEBuilder', () => {
  let builder: CTEBuilder;

  beforeEach(() => {
    builder = new CTEBuilder('dyna_');
  });

  describe('buildCTEs', () => {
    it('should build CTEs for single table', () => {
      const metricsByTable = new Map<string, MetricConfig[]>([
        [
          'transactions',
          [
            {
              table: 'transactions',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'sales',
            },
          ],
        ],
      ]);

      const currentWhere = '  WHERE date >= {current_date_0:String}';
      const previousWhere = '  WHERE date >= {previous_date_0:String}';

      const ctes = builder.buildCTEs(metricsByTable, currentWhere, previousWhere);

      expect(ctes).toHaveLength(2);

      // Current period CTE
      expect(ctes[0].cteName).toBe('transactions_current');
      expect(ctes[0].cteSQL).toContain('SELECT sum(sales_price) AS sales');
      expect(ctes[0].cteSQL).toContain('FROM dyna_transactions');
      expect(ctes[0].cteSQL).toContain(currentWhere);
      expect(ctes[0].metrics).toEqual(metricsByTable.get('transactions'));

      // Previous period CTE
      expect(ctes[1].cteName).toBe('transactions_previous');
      expect(ctes[1].cteSQL).toContain('SELECT sum(sales_price) AS sales_ly');
      expect(ctes[1].cteSQL).toContain('FROM dyna_transactions');
      expect(ctes[1].cteSQL).toContain(previousWhere);
    });

    it('should build CTEs for multiple tables', () => {
      const metricsByTable = new Map<string, MetricConfig[]>([
        [
          'transactions',
          [
            {
              table: 'transactions',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'sales',
            },
          ],
        ],
        [
          'budget',
          [
            {
              table: 'budget',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'budget',
            },
          ],
        ],
      ]);

      const currentWhere = '  WHERE date >= {current_date_0:String}';
      const previousWhere = '  WHERE date >= {previous_date_0:String}';

      const ctes = builder.buildCTEs(metricsByTable, currentWhere, previousWhere);

      expect(ctes).toHaveLength(4); // 2 tables × 2 periods

      // Verify all CTE names are present
      const cteNames = ctes.map((cte) => cte.cteName);
      expect(cteNames).toContain('transactions_current');
      expect(cteNames).toContain('transactions_previous');
      expect(cteNames).toContain('budget_current');
      expect(cteNames).toContain('budget_previous');
    });

    it('should handle multiple metrics from same table', () => {
      const metricsByTable = new Map<string, MetricConfig[]>([
        [
          'transactions',
          [
            {
              table: 'transactions',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'sales',
            },
            {
              table: 'transactions',
              field: 'gross_margin',
              aggregation: 'sum',
              alias: 'gross_margin',
            },
          ],
        ],
      ]);

      const ctes = builder.buildCTEs(metricsByTable, '', '');

      // Current period should have both metrics
      expect(ctes[0].cteSQL).toContain('sum(sales_price) AS sales');
      expect(ctes[0].cteSQL).toContain('sum(gross_margin) AS gross_margin');

      // Previous period should have both metrics with _ly suffix
      expect(ctes[1].cteSQL).toContain('sum(sales_price) AS sales_ly');
      expect(ctes[1].cteSQL).toContain('sum(gross_margin) AS gross_margin_ly');
    });

    it('should work without table prefix', () => {
      const builderNoPrefix = new CTEBuilder();
      const metricsByTable = new Map<string, MetricConfig[]>([
        [
          'transactions',
          [
            {
              table: 'transactions',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'sales',
            },
          ],
        ],
      ]);

      const ctes = builderNoPrefix.buildCTEs(metricsByTable, '', '');

      expect(ctes[0].cteSQL).toContain('FROM transactions');
      expect(ctes[0].cteSQL).not.toContain('dyna_');
    });
  });

  describe('buildGroupedCTEs', () => {
    it('should build grouped CTEs with GROUP BY clause', () => {
      const metricsByTable = new Map<string, MetricConfig[]>([
        [
          'transactions',
          [
            {
              table: 'transactions',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'sales',
            },
          ],
        ],
      ]);

      const currentWhere = '  WHERE date >= {current_date_0:String}';
      const previousWhere = '  WHERE date >= {previous_date_0:String}';
      const groupBy = 'region';

      const ctes = builder.buildGroupedCTEs(
        metricsByTable,
        currentWhere,
        previousWhere,
        groupBy
      );

      expect(ctes).toHaveLength(2);

      // Current period CTE should have GROUP BY
      expect(ctes[0].cteSQL).toContain('SELECT region, sum(sales_price) AS sales');
      expect(ctes[0].cteSQL).toContain('GROUP BY region');

      // Previous period CTE should have GROUP BY
      expect(ctes[1].cteSQL).toContain('SELECT region, sum(sales_price) AS sales_ly');
      expect(ctes[1].cteSQL).toContain('GROUP BY region');
    });

    it('should build grouped CTEs for multiple tables', () => {
      const metricsByTable = new Map<string, MetricConfig[]>([
        [
          'transactions',
          [
            {
              table: 'transactions',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'sales',
            },
          ],
        ],
        [
          'budget',
          [
            {
              table: 'budget',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'budget',
            },
          ],
        ],
      ]);

      const groupBy = 'product';

      const ctes = builder.buildGroupedCTEs(metricsByTable, '', '', groupBy);

      expect(ctes).toHaveLength(4);

      // All CTEs should have the groupBy field and GROUP BY clause
      for (const cte of ctes) {
        expect(cte.cteSQL).toContain(`SELECT ${groupBy},`);
        expect(cte.cteSQL).toContain(`GROUP BY ${groupBy}`);
      }
    });

    it('should handle multiple metrics in grouped query', () => {
      const metricsByTable = new Map<string, MetricConfig[]>([
        [
          'transactions',
          [
            {
              table: 'transactions',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'sales',
            },
            {
              table: 'transactions',
              field: 'gross_margin',
              aggregation: 'avg',
              alias: 'avg_margin',
            },
          ],
        ],
      ]);

      const groupBy = 'category';

      const ctes = builder.buildGroupedCTEs(metricsByTable, '', '', groupBy);

      // Current period should have both metrics
      expect(ctes[0].cteSQL).toContain('SELECT category, sum(sales_price) AS sales');
      expect(ctes[0].cteSQL).toContain('avg(gross_margin) AS avg_margin');
      expect(ctes[0].cteSQL).toContain('GROUP BY category');

      // Previous period should have both metrics with _ly suffix
      expect(ctes[1].cteSQL).toContain('SELECT category, sum(sales_price) AS sales_ly');
      expect(ctes[1].cteSQL).toContain('avg(gross_margin) AS avg_margin_ly');
      expect(ctes[1].cteSQL).toContain('GROUP BY category');
    });
  });

  describe('CTE structure', () => {
    it('should return correct CTE data structure', () => {
      const metricsByTable = new Map<string, MetricConfig[]>([
        [
          'transactions',
          [
            {
              table: 'transactions',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'sales',
            },
          ],
        ],
      ]);

      const ctes = builder.buildCTEs(metricsByTable, '', '');

      expect(ctes[0]).toHaveProperty('cteName');
      expect(ctes[0]).toHaveProperty('cteSQL');
      expect(ctes[0]).toHaveProperty('metrics');

      expect(typeof ctes[0].cteName).toBe('string');
      expect(typeof ctes[0].cteSQL).toBe('string');
      expect(Array.isArray(ctes[0].metrics)).toBe(true);
    });
  });
});
