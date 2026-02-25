import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceService } from '../../../src/features/balance/balance.service.js';
import { BALANCE_METRICS } from '../../../src/core/config/metrics.config.js';
import type { BalanceQueryParams } from '../../../src/features/balance/balance.schemas.js';
import type { IAnalyticsQueryBuilder, FilterCondition } from '../../../src/core/db/clickhouse/query/interfaces.js';
import {
  generateMockQueryResult,
  generateExpectedResponse,
  generateEmptyResponse,
} from '../../helpers/test-data-builder.js';

// Mock IAnalyticsQueryBuilder
const mockBuildMultiTableYoYQuery = vi.fn();

function createMockAnalyticsBuilder(): IAnalyticsQueryBuilder {
  return {
    buildMultiTableYoYQuery: mockBuildMultiTableYoYQuery,
    buildGroupedMultiTableYoYQuery: vi.fn(),
  };
}

describe('BalanceService', () => {
  let mockAnalyticsBuilder: IAnalyticsQueryBuilder;
  let service: BalanceService;

  beforeEach(() => {
    mockAnalyticsBuilder = createMockAnalyticsBuilder();
    service = new BalanceService(mockAnalyticsBuilder);
    vi.clearAllMocks();
  });

  describe('getBalanceSheet', () => {
    it('should return complete balance sheet with all metrics (DYNAMIC)', async () => {
      // Generate mock data dynamically - if you add metrics to config, this test adapts!
      const mockQueryResult = generateMockQueryResult({
        budget: 9000,
        budget_ly: 8500,
        sales: 10000,
        sales_ly: 8000,
        gross_margin: 3000,
        gross_margin_ly: 2400,
        orders: 11000,
        orders_ly: 10000,
        sales_vs_budget: 11.11,
        budget_achievement_pct: 111.11,
        order_fulfillment_pct: 110.0,
      });

      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const params: BalanceQueryParams = {
        startDate: '2025-12-01',
        endDate: '2025-12-31',
      };

      const result = await service.getBalanceSheet(params);

      // Expected response is generated dynamically from mock data
      const expected = generateExpectedResponse(mockQueryResult);
      expect(result).toEqual(expected);
    });

    it('should handle missing values with defaults (DYNAMIC)', async () => {
      const mockQueryResult = {};

      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const params: BalanceQueryParams = {
        startDate: '2025-12-01',
        endDate: '2025-12-31',
      };

      const result = await service.getBalanceSheet(params);

      // All metrics default to 0 when missing - generated dynamically!
      const expected = generateEmptyResponse();
      expect(result).toEqual(expected);
    });

    it('should call AnalyticsQueryBuilder with correct metrics from config', async () => {
      const mockQueryResult = generateMockQueryResult({
        budget: 4500,
        budget_ly: 4200,
        sales: 5000,
        sales_ly: 4000,
        gross_margin: 2000,
        gross_margin_ly: 1800,
        orders: 5500,
        orders_ly: 5000,
      });

      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const params: BalanceQueryParams = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      await service.getBalanceSheet(params);

      // Verify it uses BALANCE_METRICS from config
      expect(mockBuildMultiTableYoYQuery).toHaveBeenCalledWith({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: [
          { field: 'date', operator: 'gte', value: '2025-01-01' },
          { field: 'date', operator: 'lte', value: '2025-12-31' },
        ],
      });
    });

    it('should handle date filters correctly', async () => {
      const mockQueryResult = generateMockQueryResult({
        budget: 2800,
        budget_ly: 2600,
        sales: 3000,
        sales_ly: 2500,
        gross_margin: 1200,
        gross_margin_ly: 1000,
        orders: 3200,
        orders_ly: 3000,
      });

      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const params: BalanceQueryParams = {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
      };

      await service.getBalanceSheet(params);

      expect(mockBuildMultiTableYoYQuery).toHaveBeenCalledWith({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: [
          { field: 'date', operator: 'gte', value: '2025-06-01' },
          { field: 'date', operator: 'lte', value: '2025-06-30' },
        ],
      });
    });

    it('should handle no filters', async () => {
      const mockQueryResult = generateMockQueryResult({
        budget: 14000,
        budget_ly: 13000,
        sales: 15000,
        sales_ly: 12000,
        gross_margin: 6000,
        gross_margin_ly: 4800,
        orders: 16000,
        orders_ly: 15000,
      });

      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const params: BalanceQueryParams = {};

      await service.getBalanceSheet(params);

      expect(mockBuildMultiTableYoYQuery).toHaveBeenCalledWith({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: [],
      });
    });

    it('should handle only startDate parameter', async () => {
      const mockQueryResult = generateMockQueryResult({
        budget: 5500,
        budget_ly: 5000,
        sales: 6000,
        sales_ly: 5000,
        gross_margin: 2400,
        gross_margin_ly: 2000,
        orders: 6500,
        orders_ly: 6000,
      });

      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const params: BalanceQueryParams = {
        startDate: '2025-06-01',
      };

      await service.getBalanceSheet(params);

      expect(mockBuildMultiTableYoYQuery).toHaveBeenCalledWith({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: [
          { field: 'date', operator: 'gte', value: '2025-06-01' },
        ],
      });
    });

    it('should handle only endDate parameter', async () => {
      const mockQueryResult = generateMockQueryResult({
        budget: 6500,
        budget_ly: 6000,
        sales: 7000,
        sales_ly: 6000,
        gross_margin: 2800,
        gross_margin_ly: 2400,
        orders: 7500,
        orders_ly: 7000,
      });

      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const params: BalanceQueryParams = {
        endDate: '2025-06-30',
      };

      await service.getBalanceSheet(params);

      expect(mockBuildMultiTableYoYQuery).toHaveBeenCalledWith({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: [
          { field: 'date', operator: 'lte', value: '2025-06-30' },
        ],
      });
    });
  });

  describe('dynamic filters', () => {
    it('should pass dynamic filters directly to analytics builder', async () => {
      const mockQueryResult = generateMockQueryResult();
      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
        { field: 'seller_id', operator: 'in', value: ['S001', 'S002'] },
        { field: 'country', operator: 'eq', value: 'españa' }
      ];

      await service.getBalanceSheet({ filters });

      expect(mockBuildMultiTableYoYQuery).toHaveBeenCalledWith({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: filters,
      });
    });

    it('should handle single filter', async () => {
      const mockQueryResult = generateMockQueryResult();
      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const filters: FilterCondition[] = [
        { field: 'seller_id', operator: 'eq', value: 'S001' }
      ];

      await service.getBalanceSheet({ filters });

      expect(mockBuildMultiTableYoYQuery).toHaveBeenCalledWith({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: filters,
      });
    });

    it('should handle multiple dynamic filters', async () => {
      const mockQueryResult = generateMockQueryResult();
      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const filters: FilterCondition[] = [
        { field: 'seller_id', operator: 'eq', value: 'S001' },
        { field: 'country', operator: 'in', value: ['españa', 'portugal'] },
        { field: 'region', operator: 'in', value: ['north', 'south'] },
        { field: 'status', operator: 'eq', value: 'active' }
      ];

      await service.getBalanceSheet({ filters });

      expect(mockBuildMultiTableYoYQuery).toHaveBeenCalledWith({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: filters,
      });
    });

    it('should handle empty filters array', async () => {
      const mockQueryResult = generateMockQueryResult();
      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      await service.getBalanceSheet({ filters: [] });

      expect(mockBuildMultiTableYoYQuery).toHaveBeenCalledWith({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: [],
      });
    });

    it('should still accept legacy params format for backward compatibility', async () => {
      const mockQueryResult = generateMockQueryResult();
      mockBuildMultiTableYoYQuery.mockResolvedValue(mockQueryResult);

      const params: BalanceQueryParams = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      await service.getBalanceSheet(params);

      expect(mockBuildMultiTableYoYQuery).toHaveBeenCalledWith({
        metrics: BALANCE_METRICS,
        currentPeriodFilters: [
          { field: 'date', operator: 'gte', value: '2025-01-01' },
          { field: 'date', operator: 'lte', value: '2025-12-31' },
        ],
      });
    });
  });
});
