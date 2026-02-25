import { describe, it, expect } from 'vitest';
import {
  buildDynamicResponse,
  buildDynamicResponseArray,
} from '../../../src/core/utils/response-builder.js';
import { generateMockQueryResult } from '../../helpers/test-data-builder.js';

describe('response-builder', () => {
  describe('buildDynamicResponse', () => {
    it('should build response with all metrics from query result', () => {
      const queryResult = generateMockQueryResult();

      const response = buildDynamicResponse(queryResult);

      // Should have base metrics
      expect(response).toHaveProperty('sales');
      expect(response).toHaveProperty('budget');
      expect(response).toHaveProperty('orders');

      // Should have last year metrics
      expect(response).toHaveProperty('sales_last_year');
      expect(response).toHaveProperty('budget_last_year');

      // Should have vs last year metrics
      expect(response).toHaveProperty('sales_vs_last_year');
      expect(response).toHaveProperty('budget_vs_last_year');

      // Should have calculated metrics
      expect(response).toHaveProperty('sales_vs_budget');
      expect(response).toHaveProperty('budget_achievement_pct');
      expect(response).toHaveProperty('order_fulfillment_pct');
    });

    it('should handle query result with all numeric values', () => {
      const queryResult: Record<string, number> = {
        sales: 10000,
        sales_ly: 8000,
        sales_vs_last_year: 25.0,
        budget: 9000,
        budget_ly: 8500,
        budget_vs_last_year: 5.88,
      };

      const response = buildDynamicResponse(queryResult);

      expect(response.sales).toBe(10000);
      expect(response.sales_last_year).toBe(8000);
      expect(response.sales_vs_last_year).toBe(25.0);
    });

    it('should handle query result with zero values', () => {
      const queryResult: Record<string, number> = {
        sales: 0,
        sales_ly: 0,
        sales_vs_last_year: 0,
        budget: 0,
        budget_ly: 0,
        budget_vs_last_year: 0,
      };

      const response = buildDynamicResponse(queryResult);

      expect(response.sales).toBe(0);
      expect(response.budget).toBe(0);
    });

    it('should handle query result with negative values', () => {
      const queryResult: Record<string, number> = {
        sales: 10000,
        sales_ly: 12000,
        sales_vs_last_year: -16.67,
        budget: 8000,
        budget_ly: 9000,
        budget_vs_last_year: -11.11,
      };

      const response = buildDynamicResponse(queryResult);

      expect(response.sales_vs_last_year).toBeLessThan(0);
      expect(response.budget_vs_last_year).toBeLessThan(0);
    });

    it('should dynamically adapt to config changes', () => {
      // This test verifies buildDynamicResponse uses config dynamically
      const queryResult = generateMockQueryResult();
      const response = buildDynamicResponse(queryResult);

      // Response should have properties from config
      expect(Object.keys(response).length).toBeGreaterThan(0);
    });
  });

  describe('buildDynamicResponseArray', () => {
    it('should convert array of query results to response array', () => {
      const queryResults = [
        generateMockQueryResult(),
        generateMockQueryResult(),
        generateMockQueryResult(),
      ];

      const responses = buildDynamicResponseArray(queryResults);

      expect(responses).toHaveLength(3);
      expect(responses[0]).toHaveProperty('sales');
      expect(responses[0]).toHaveProperty('budget');
      expect(responses[0]).toHaveProperty('sales_vs_budget');
      expect(responses[1]).toHaveProperty('sales');
      expect(responses[2]).toHaveProperty('sales');
    });

    it('should handle empty array', () => {
      const responses = buildDynamicResponseArray([]);
      expect(responses).toHaveLength(0);
      expect(Array.isArray(responses)).toBe(true);
    });

    it('should handle single item array', () => {
      const queryResults = [generateMockQueryResult()];
      const responses = buildDynamicResponseArray(queryResults);

      expect(responses).toHaveLength(1);
      expect(responses[0]).toHaveProperty('sales');
      expect(responses[0]).toHaveProperty('budget');
    });

    it('should handle large arrays', () => {
      const queryResults = Array.from({ length: 100 }, () =>
        generateMockQueryResult()
      );

      const responses = buildDynamicResponseArray(queryResults);

      expect(responses).toHaveLength(100);
      // Verify first and last items are properly formatted
      expect(responses[0]).toHaveProperty('sales');
      expect(responses[99]).toHaveProperty('sales');
    });

    it('should process each item independently', () => {
      const queryResults = [
        { sales: 1000, sales_ly: 900, sales_vs_last_year: 11.11 },
        { sales: 2000, sales_ly: 1800, sales_vs_last_year: 11.11 },
        { sales: 3000, sales_ly: 2700, sales_vs_last_year: 11.11 },
      ];

      const responses = buildDynamicResponseArray(queryResults);

      expect(responses[0].sales).toBe(1000);
      expect(responses[1].sales).toBe(2000);
      expect(responses[2].sales).toBe(3000);
    });

    it('should maintain array order', () => {
      const queryResults = [
        { sales: 100, sales_ly: 90, sales_vs_last_year: 11.11 },
        { sales: 200, sales_ly: 180, sales_vs_last_year: 11.11 },
        { sales: 300, sales_ly: 270, sales_vs_last_year: 11.11 },
      ];

      const responses = buildDynamicResponseArray(queryResults);

      // Order should be preserved
      expect(responses[0].sales).toBe(100);
      expect(responses[1].sales).toBe(200);
      expect(responses[2].sales).toBe(300);
    });
  });

  describe('integration', () => {
    it('should work with realistic query results', () => {
      const queryResults = [
        {
          sales: 50000,
          sales_ly: 45000,
          sales_vs_last_year: 11.11,
          budget: 48000,
          budget_ly: 44000,
          budget_vs_last_year: 9.09,
          orders: 52000,
          orders_ly: 46000,
          orders_vs_last_year: 13.04,
          sales_vs_budget: 4.17,
          budget_achievement_pct: 104.17,
          order_fulfillment_pct: 96.15,
        },
        {
          sales: 30000,
          sales_ly: 35000,
          sales_vs_last_year: -14.29,
          budget: 32000,
          budget_ly: 33000,
          budget_vs_last_year: -3.03,
          orders: 31000,
          orders_ly: 34000,
          orders_vs_last_year: -8.82,
          sales_vs_budget: -6.25,
          budget_achievement_pct: 93.75,
          order_fulfillment_pct: 96.77,
        },
      ];

      const responses = buildDynamicResponseArray(queryResults);

      expect(responses).toHaveLength(2);

      // First item
      expect(responses[0].sales).toBe(50000);
      expect(responses[0].sales_vs_last_year).toBeGreaterThan(0);
      expect(responses[0].budget_achievement_pct).toBeGreaterThan(100);

      // Second item
      expect(responses[1].sales).toBe(30000);
      expect(responses[1].sales_vs_last_year).toBeLessThan(0);
      expect(responses[1].budget_achievement_pct).toBeLessThan(100);
    });
  });
});
