import { describe, it, expect, beforeEach } from 'vitest';
import { MetricCalculator } from '../../../src/core/db/clickhouse/query/metric-calculator.js';
import { CALCULATED_METRICS } from '../../../src/core/config/metrics.config.js';
import type { MetricConfig } from '../../../src/core/db/clickhouse/query/types.js';

describe('MetricCalculator', () => {
  let calculator: MetricCalculator;

  beforeEach(() => {
    calculator = new MetricCalculator();
  });

  describe('addCalculatedMetrics', () => {
    it('should add all calculated metrics when dependencies are available', () => {
      const selects: string[] = [];
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
        [
          'pedidos_retenidos',
          [
            {
              table: 'pedidos_retenidos',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'orders',
            },
          ],
        ],
      ]);

      calculator.addCalculatedMetrics(selects, metricsByTable);

      // Should have exactly the number of calculated metrics from config
      expect(selects.length).toBe(CALCULATED_METRICS.length);

      // Verify each calculated metric from config is present
      for (const calcMetric of CALCULATED_METRICS) {
        const found = selects.some((select) => select.includes(`AS ${calcMetric.name}`));
        expect(found).toBe(true);
      }
    });

    it('should replace placeholders with correct CTE references', () => {
      const selects: string[] = [];
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

      calculator.addCalculatedMetrics(selects, metricsByTable);

      // Find sales_vs_budget metric (depends on sales and budget)
      const salesVsBudget = selects.find((s) => s.includes('AS sales_vs_budget'));
      expect(salesVsBudget).toBeDefined();

      // Should replace {sales} with transactions_current.sales
      expect(salesVsBudget).toContain('transactions_current.sales');

      // Should replace {budget} with budget_current.budget
      expect(salesVsBudget).toContain('budget_current.budget');

      // Should NOT contain placeholder braces
      expect(salesVsBudget).not.toContain('{sales}');
      expect(salesVsBudget).not.toContain('{budget}');
    });

    it('should skip metrics when dependencies are missing', () => {
      const selects: string[] = [];
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
        // Missing 'budget' dependency
      ]);

      calculator.addCalculatedMetrics(selects, metricsByTable);

      // sales_vs_budget requires both sales AND budget
      // Should be skipped if budget is missing
      const salesVsBudget = selects.find((s) => s.includes('AS sales_vs_budget'));
      expect(salesVsBudget).toBeUndefined();

      // budget_achievement_pct also requires budget
      const budgetAchievement = selects.find((s) => s.includes('AS budget_achievement_pct'));
      expect(budgetAchievement).toBeUndefined();
    });

    it('should include metrics when partial dependencies are met', () => {
      const selects: string[] = [];
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
          'pedidos_retenidos',
          [
            {
              table: 'pedidos_retenidos',
              field: 'sales_price',
              aggregation: 'sum',
              alias: 'orders',
            },
          ],
        ],
        // Budget is missing
      ]);

      calculator.addCalculatedMetrics(selects, metricsByTable);

      // order_fulfillment_pct requires sales and orders (both available)
      const orderFulfillment = selects.find((s) => s.includes('AS order_fulfillment_pct'));
      expect(orderFulfillment).toBeDefined();
      expect(orderFulfillment).toContain('transactions_current.sales');
      expect(orderFulfillment).toContain('pedidos_retenidos_current.orders');

      // sales_vs_budget requires budget (not available)
      const salesVsBudget = selects.find((s) => s.includes('AS sales_vs_budget'));
      expect(salesVsBudget).toBeUndefined();
    });

    it('should handle metrics from same table', () => {
      const selects: string[] = [];
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

      calculator.addCalculatedMetrics(selects, metricsByTable);

      // Both should reference transactions_current CTE
      for (const select of selects) {
        expect(select).toContain('transactions_current');
      }
    });

    it('should not mutate metricsByTable input', () => {
      const selects: string[] = [];
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

      const originalSize = metricsByTable.size;
      const originalMetrics = metricsByTable.get('transactions');

      calculator.addCalculatedMetrics(selects, metricsByTable);

      // Should not modify the input map
      expect(metricsByTable.size).toBe(originalSize);
      expect(metricsByTable.get('transactions')).toBe(originalMetrics);
    });

    it('should be config-driven (DYNAMIC TEST)', () => {
      // This test verifies that MetricCalculator reads from CALCULATED_METRICS
      // If you add a new calculated metric to config, this test ensures it's used

      const selects: string[] = [];
      const metricsByTable = new Map<string, MetricConfig[]>();

      // Add all possible dependencies from config
      const allDependencies = new Set<string>();
      for (const calcMetric of CALCULATED_METRICS) {
        for (const dep of calcMetric.dependencies) {
          allDependencies.add(dep);
        }
      }

      // Create metrics for all dependencies
      for (const dep of allDependencies) {
        metricsByTable.set(dep, [
          {
            table: dep,
            field: 'value',
            aggregation: 'sum',
            alias: dep,
          },
        ]);
      }

      calculator.addCalculatedMetrics(selects, metricsByTable);

      // Should generate exactly as many metrics as in config
      expect(selects.length).toBe(CALCULATED_METRICS.length);

      // Each metric from config should be present
      for (const calcMetric of CALCULATED_METRICS) {
        const found = selects.find((s) => s.includes(`AS ${calcMetric.name}`));
        expect(found).toBeDefined();
      }
    });
  });
});
