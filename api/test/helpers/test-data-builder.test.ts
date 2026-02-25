import { describe, it, expect } from 'vitest';
import {
  generateMockQueryResult,
  generateExpectedResponse,
  generateEmptyResponse,
  getAllMetricAliases,
  getAllCalculatedMetricNames,
} from './test-data-builder.js';
import { BALANCE_METRICS, CALCULATED_METRICS } from '../../src/core/config/metrics.config.js';

describe('test-data-builder', () => {
  describe('generateMockQueryResult', () => {
    it('should generate mock data with default values', () => {
      const result = generateMockQueryResult();

      // Should have current values
      expect(result.sales).toBe(1000);
      expect(result.budget).toBe(1000);
      expect(result.orders).toBe(1000);

      // Should have last year values
      expect(result.sales_ly).toBe(800);
      expect(result.budget_ly).toBe(800);

      // Should have vs last year calculations
      expect(result.sales_vs_last_year).toBe(25); // (1000-800)/800 * 100
    });

    it('should use custom base values when provided', () => {
      const result = generateMockQueryResult({
        sales: 2000,
        sales_ly: 1500,
        budget: 1800,
      });

      expect(result.sales).toBe(2000);
      expect(result.sales_ly).toBe(1500);
      expect(result.budget).toBe(1800);
      expect(result.budget_ly).toBe(800); // Default
    });

    it('should calculate YoY percentage correctly', () => {
      const result = generateMockQueryResult({
        sales: 1200,
        sales_ly: 1000,
      });

      expect(result.sales_vs_last_year).toBe(20); // (1200-1000)/1000 * 100
    });

    it('should handle zero last year value', () => {
      const result = generateMockQueryResult({
        sales: 1000,
        sales_ly: 0,
      });

      expect(result.sales_vs_last_year).toBe(0);
    });

    it('should include all metrics from BALANCE_METRICS', () => {
      const result = generateMockQueryResult();

      for (const metric of BALANCE_METRICS) {
        expect(result).toHaveProperty(metric.alias);
        expect(result).toHaveProperty(`${metric.alias}_ly`);
        expect(result).toHaveProperty(`${metric.alias}_vs_last_year`);
      }
    });

    it('should include all calculated metrics', () => {
      const result = generateMockQueryResult();

      for (const calcMetric of CALCULATED_METRICS) {
        expect(result).toHaveProperty(calcMetric.name);
        expect(result[calcMetric.name]).toBe(100); // Default value
      }
    });

    it('should use custom values for calculated metrics', () => {
      const result = generateMockQueryResult({
        sales_vs_budget: 150,
        budget_achievement_pct: 95,
      });

      expect(result.sales_vs_budget).toBe(150);
      expect(result.budget_achievement_pct).toBe(95);
    });

    it('should round YoY percentage to 2 decimals', () => {
      const result = generateMockQueryResult({
        sales: 1234,
        sales_ly: 1000,
      });

      expect(result.sales_vs_last_year).toBe(23.4); // (1234-1000)/1000 * 100 = 23.4
    });
  });

  describe('generateExpectedResponse', () => {
    it('should transform query result to response format', () => {
      const queryResult = {
        sales: 1000,
        sales_ly: 800,
        sales_vs_last_year: 25,
        budget: 900,
        budget_ly: 850,
        budget_vs_last_year: 5.88,
      };

      const response = generateExpectedResponse(queryResult);

      // Should rename _ly to _last_year
      expect(response.sales).toBe(1000);
      expect(response.sales_last_year).toBe(800);
      expect(response.sales_vs_last_year).toBe(25);
      expect(response.budget_last_year).toBe(850);
    });

    it('should handle missing values with defaults', () => {
      const queryResult = { sales: 500 };

      const response = generateExpectedResponse(queryResult);

      expect(response.sales).toBe(500);
      expect(response.sales_last_year).toBe(0);
      expect(response.sales_vs_last_year).toBe(0);
      expect(response.budget).toBe(0);
    });

    it('should include all base metrics', () => {
      const queryResult = generateMockQueryResult();
      const response = generateExpectedResponse(queryResult);

      for (const metric of BALANCE_METRICS) {
        expect(response).toHaveProperty(metric.alias);
        expect(response).toHaveProperty(`${metric.alias}_last_year`);
        expect(response).toHaveProperty(`${metric.alias}_vs_last_year`);
      }
    });

    it('should include all calculated metrics without transformation', () => {
      const queryResult = {
        sales_vs_budget: 105,
        budget_achievement_pct: 98,
        order_fulfillment_pct: 102,
      };

      const response = generateExpectedResponse(queryResult);

      expect(response.sales_vs_budget).toBe(105);
      expect(response.budget_achievement_pct).toBe(98);
      expect(response.order_fulfillment_pct).toBe(102);
    });

    it('should work with realistic data', () => {
      const queryResult = generateMockQueryResult({
        sales: 50000,
        sales_ly: 45000,
        budget: 48000,
        budget_ly: 44000,
      });

      const response = generateExpectedResponse(queryResult);

      expect(response.sales).toBe(50000);
      expect(response.sales_last_year).toBe(45000);
      expect(response.budget).toBe(48000);
      expect(response.budget_last_year).toBe(44000);
    });
  });

  describe('generateEmptyResponse', () => {
    it('should generate response with all metrics set to 0', () => {
      const response = generateEmptyResponse();

      // All base metrics should be 0
      for (const metric of BALANCE_METRICS) {
        expect(response[metric.alias]).toBe(0);
        expect(response[`${metric.alias}_last_year`]).toBe(0);
        expect(response[`${metric.alias}_vs_last_year`]).toBe(0);
      }

      // All calculated metrics should be 0
      for (const calcMetric of CALCULATED_METRICS) {
        expect(response[calcMetric.name]).toBe(0);
      }
    });

    it('should have all expected properties', () => {
      const response = generateEmptyResponse();

      expect(Object.keys(response).length).toBeGreaterThan(0);
      expect(response).toHaveProperty('sales');
      expect(response).toHaveProperty('sales_last_year');
      expect(response).toHaveProperty('budget');
    });
  });

  describe('getAllMetricAliases', () => {
    it('should return all metric aliases from config', () => {
      const aliases = getAllMetricAliases();

      expect(aliases).toContain('sales');
      expect(aliases).toContain('budget');
      expect(aliases).toContain('orders');
      expect(aliases.length).toBe(BALANCE_METRICS.length);
    });

    it('should return array of strings', () => {
      const aliases = getAllMetricAliases();

      expect(Array.isArray(aliases)).toBe(true);
      for (const alias of aliases) {
        expect(typeof alias).toBe('string');
      }
    });

    it('should match BALANCE_METRICS order', () => {
      const aliases = getAllMetricAliases();
      const expectedAliases = BALANCE_METRICS.map(m => m.alias);

      expect(aliases).toEqual(expectedAliases);
    });
  });

  describe('getAllCalculatedMetricNames', () => {
    it('should return all calculated metric names from config', () => {
      const names = getAllCalculatedMetricNames();

      expect(names).toContain('sales_vs_budget');
      expect(names).toContain('budget_achievement_pct');
      expect(names).toContain('order_fulfillment_pct');
      expect(names.length).toBe(CALCULATED_METRICS.length);
    });

    it('should return array of strings', () => {
      const names = getAllCalculatedMetricNames();

      expect(Array.isArray(names)).toBe(true);
      for (const name of names) {
        expect(typeof name).toBe('string');
      }
    });

    it('should match CALCULATED_METRICS order', () => {
      const names = getAllCalculatedMetricNames();
      const expectedNames = CALCULATED_METRICS.map(m => m.name);

      expect(names).toEqual(expectedNames);
    });
  });

  describe('integration', () => {
    it('should work together to generate and transform test data', () => {
      // Generate mock query result
      const queryResult = generateMockQueryResult({
        sales: 10000,
        sales_ly: 8000,
      });

      // Transform to expected response
      const response = generateExpectedResponse(queryResult);

      // Verify transformation
      expect(response.sales).toBe(queryResult.sales);
      expect(response.sales_last_year).toBe(queryResult.sales_ly);
      expect(response.sales_vs_last_year).toBe(queryResult.sales_vs_last_year);
    });

    it('should be dynamic and adapt to config changes', () => {
      // This test verifies that adding metrics to config
      // automatically updates test data generation

      const queryResult = generateMockQueryResult();
      const aliases = getAllMetricAliases();
      const calcNames = getAllCalculatedMetricNames();

      // All aliases should exist in query result
      for (const alias of aliases) {
        expect(queryResult).toHaveProperty(alias);
      }

      // All calculated metrics should exist
      for (const name of calcNames) {
        expect(queryResult).toHaveProperty(name);
      }
    });

    it('should handle negative YoY values correctly', () => {
      const queryResult = generateMockQueryResult({
        sales: 800,
        sales_ly: 1000,
      });

      expect(queryResult.sales_vs_last_year).toBe(-20); // (800-1000)/1000 * 100
      expect(queryResult.sales_vs_last_year).toBeLessThan(0);
    });

    it('should maintain precision in calculations', () => {
      const queryResult = generateMockQueryResult({
        sales: 12345,
        sales_ly: 10000,
      });

      // Should round to 2 decimals
      expect(queryResult.sales_vs_last_year).toBe(23.45);
      expect(Number.isFinite(queryResult.sales_vs_last_year)).toBe(true);
    });
  });
});
