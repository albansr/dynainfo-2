import { describe, it, expect } from 'vitest';
import {
  getAllMetricAliases,
  getAllCalculatedMetricNames,
  getAllResponseFields,
  BALANCE_METRICS,
  CALCULATED_METRICS,
} from '../../../src/core/config/metrics.config.js';

describe('metrics.config utility functions', () => {
  describe('getAllMetricAliases', () => {
    it('should return all metric aliases', () => {
      const aliases = getAllMetricAliases();

      expect(aliases).toContain('sales');
      expect(aliases).toContain('budget');
      expect(aliases).toContain('orders');
      expect(aliases.length).toBe(BALANCE_METRICS.length);
    });

    it('should be dynamic and adapt to BALANCE_METRICS config', () => {
      const aliases = getAllMetricAliases();

      // Verify each metric from config is included
      for (const metric of BALANCE_METRICS) {
        expect(aliases).toContain(metric.alias);
      }
    });
  });

  describe('getAllCalculatedMetricNames', () => {
    it('should return all calculated metric names', () => {
      const names = getAllCalculatedMetricNames();

      expect(names).toContain('sales_vs_budget');
      expect(names).toContain('budget_achievement_pct');
      expect(names).toContain('order_fulfillment_pct');
      expect(names.length).toBe(CALCULATED_METRICS.length);
    });

    it('should be dynamic and adapt to CALCULATED_METRICS config', () => {
      const names = getAllCalculatedMetricNames();

      // Verify each calculated metric from config is included
      for (const metric of CALCULATED_METRICS) {
        expect(names).toContain(metric.name);
      }
    });
  });

  describe('getAllResponseFields', () => {
    it('should return complete list of response fields', () => {
      const fields = getAllResponseFields();

      // Should include current values
      expect(fields).toContain('sales');
      expect(fields).toContain('budget');
      expect(fields).toContain('orders');

      // Should include last year values
      expect(fields).toContain('sales_last_year');
      expect(fields).toContain('budget_last_year');
      expect(fields).toContain('orders_last_year');

      // Should include vs last year
      expect(fields).toContain('sales_vs_last_year');
      expect(fields).toContain('budget_vs_last_year');
      expect(fields).toContain('orders_vs_last_year');

      // Should include calculated metrics
      expect(fields).toContain('sales_vs_budget');
      expect(fields).toContain('budget_achievement_pct');
      expect(fields).toContain('order_fulfillment_pct');
    });

    it('should have correct total count of fields', () => {
      const fields = getAllResponseFields();

      // Verify count: each metric has 3 fields (current, last_year, vs_last_year) + calculated metrics
      const expectedCount =
        BALANCE_METRICS.length * 3 + CALCULATED_METRICS.length;
      expect(fields.length).toBe(expectedCount);
    });

    it('should generate all variants for each base metric', () => {
      const fields = getAllResponseFields();
      const aliases = getAllMetricAliases();

      // For each base metric, verify all 3 variants exist
      for (const alias of aliases) {
        expect(fields).toContain(alias);
        expect(fields).toContain(`${alias}_last_year`);
        expect(fields).toContain(`${alias}_vs_last_year`);
      }
    });

    it('should include all calculated metrics', () => {
      const fields = getAllResponseFields();
      const calculatedNames = getAllCalculatedMetricNames();

      // Verify all calculated metrics are included
      for (const name of calculatedNames) {
        expect(fields).toContain(name);
      }
    });

    it('should be dynamic and adapt to config changes', () => {
      // This test verifies the function will automatically adapt
      // when metrics are added/removed from config

      const fields = getAllResponseFields();

      // Should have at least base metrics * 3 + calculated metrics
      expect(fields.length).toBeGreaterThan(3);

      // All fields should be strings
      for (const field of fields) {
        expect(typeof field).toBe('string');
        expect(field.length).toBeGreaterThan(0);
      }
    });
  });

  describe('config consistency', () => {
    it('should have consistent metric structure in BALANCE_METRICS', () => {
      // Verify all metrics have required fields
      for (const metric of BALANCE_METRICS) {
        expect(metric).toHaveProperty('table');
        expect(metric).toHaveProperty('field');
        expect(metric).toHaveProperty('aggregation');
        expect(metric).toHaveProperty('alias');

        expect(typeof metric.table).toBe('string');
        expect(typeof metric.field).toBe('string');
        expect(typeof metric.aggregation).toBe('string');
        expect(typeof metric.alias).toBe('string');
      }
    });

    it('should have consistent metric structure in CALCULATED_METRICS', () => {
      // Verify all calculated metrics have required fields
      for (const metric of CALCULATED_METRICS) {
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('formula');
        expect(metric).toHaveProperty('dependencies');
        expect(metric).toHaveProperty('description');

        expect(typeof metric.name).toBe('string');
        expect(typeof metric.formula).toBe('string');
        expect(typeof metric.description).toBe('string');
        expect(Array.isArray(metric.dependencies)).toBe(true);
      }
    });

    it('should have unique metric aliases', () => {
      const aliases = getAllMetricAliases();
      const uniqueAliases = [...new Set(aliases)];

      // No duplicates
      expect(aliases.length).toBe(uniqueAliases.length);
    });

    it('should have unique calculated metric names', () => {
      const names = getAllCalculatedMetricNames();
      const uniqueNames = [...new Set(names)];

      // No duplicates
      expect(names.length).toBe(uniqueNames.length);
    });
  });
});
