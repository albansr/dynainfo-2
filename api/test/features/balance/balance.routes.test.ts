import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { generateMockQueryResult, generateExpectedResponse } from '../../helpers/test-data-builder.js';

// Mock ALL dependencies BEFORE importing anything
const mockGetBalanceSheet = vi.fn();
const mockAnalyticsBuilder = {
  buildMultiTableYoYQuery: vi.fn(),
  buildGroupedMultiTableYoYQuery: vi.fn(),
};

vi.mock('../../../src/features/balance/balance.service.js', () => ({
  BalanceService: vi.fn(function() {
    // @ts-expect-error - mocking constructor
    this.getBalanceSheet = mockGetBalanceSheet;
  }),
}));

vi.mock('../../../src/core/db/clickhouse/query/analytics-query-builder.js', () => ({
  AnalyticsQueryBuilder: vi.fn(function() {
    // @ts-expect-error - mocking constructor
    this.buildMultiTableYoYQuery = mockAnalyticsBuilder.buildMultiTableYoYQuery;
    // @ts-expect-error - mocking constructor
    this.buildGroupedMultiTableYoYQuery = mockAnalyticsBuilder.buildGroupedMultiTableYoYQuery;
  }),
}));

// NOW import the module under test
import { balanceRoutes } from '../../../src/features/balance/balance.routes.js';
import type { DatabaseClient } from '../../../src/core/db/client.js';

// Mock DatabaseClient
function createMockDbClient() {
  return {
    getClient: vi.fn().mockReturnValue({} as any),
  } as unknown as DatabaseClient;
}

describe('Balance Routes', () => {
  let app: FastifyInstance;
  let mockDbClient: DatabaseClient;

  beforeEach(async () => {
    app = Fastify();

    // Disable schema validation for tests (much faster)
    app.setValidatorCompiler(() => () => true);
    app.setSerializerCompiler(() => (data) => JSON.stringify(data));

    mockDbClient = createMockDbClient();

    vi.clearAllMocks();

    // Register routes
    await balanceRoutes(app, mockDbClient);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /balance', () => {
    it('should return balance sheet with all metrics (DYNAMIC)', async () => {
      // Generate mock data dynamically
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

      const expectedResponse = generateExpectedResponse(mockQueryResult);

      mockGetBalanceSheet.mockResolvedValue(expectedResponse);

      const response = await app.inject({
        method: 'GET',
        url: '/balance?startDate=2025-12-01&endDate=2025-12-31',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: expectedResponse,
      });
    });

    it('should handle query parameters correctly', async () => {
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

      const expectedResponse = generateExpectedResponse(mockQueryResult);

      mockGetBalanceSheet.mockResolvedValue(expectedResponse);

      const response = await app.inject({
        method: 'GET',
        url: '/balance?startDate=2025-01-01&endDate=2025-12-31',
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetBalanceSheet).toHaveBeenCalledWith({
        filters: [
          { field: 'date', operator: 'gte', value: '2025-01-01' },
          { field: 'date', operator: 'lte', value: '2025-12-31' },
        ],
      });
    });

    it('should handle request without query parameters', async () => {
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

      const expectedResponse = generateExpectedResponse(mockQueryResult);

      mockGetBalanceSheet.mockResolvedValue(expectedResponse);

      const response = await app.inject({
        method: 'GET',
        url: '/balance',
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetBalanceSheet).toHaveBeenCalledWith({ filters: [] });
    });

    it('should return 500 on service error', async () => {
      mockGetBalanceSheet.mockRejectedValue(new Error('Database connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/balance',
      });

      expect(response.statusCode).toBe(500);
      const json = response.json();
      expect(json).toHaveProperty('error');
      expect(json.error).toBeDefined();
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

      const expectedResponse = generateExpectedResponse(mockQueryResult);

      mockGetBalanceSheet.mockResolvedValue(expectedResponse);

      const response = await app.inject({
        method: 'GET',
        url: '/balance?startDate=2025-06-01',
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetBalanceSheet).toHaveBeenCalledWith({
        filters: [
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

      const expectedResponse = generateExpectedResponse(mockQueryResult);

      mockGetBalanceSheet.mockResolvedValue(expectedResponse);

      const response = await app.inject({
        method: 'GET',
        url: '/balance?endDate=2025-06-30',
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetBalanceSheet).toHaveBeenCalledWith({
        filters: [
          { field: 'date', operator: 'lte', value: '2025-06-30' },
        ],
      });
    });
  });
});
