import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LabelsService } from '../../../src/features/labels/labels.service.js';
import type { LabelsQueryParams } from '../../../src/features/labels/labels.schemas.js';
import type { IAnalyticsQueryBuilder, FilterCondition } from '../../../src/core/db/clickhouse/query/interfaces.js';

// Mock IAnalyticsQueryBuilder
const mockBuildDistinctValuesQuery = vi.fn();

function createMockAnalyticsBuilder(): IAnalyticsQueryBuilder {
  return {
    buildMultiTableYoYQuery: vi.fn(),
    buildGroupedMultiTableYoYQuery: vi.fn(),
    buildDistinctValuesQuery: mockBuildDistinctValuesQuery,
  };
}

describe('LabelsService', () => {
  let mockAnalyticsBuilder: IAnalyticsQueryBuilder;
  let service: LabelsService;

  beforeEach(() => {
    mockAnalyticsBuilder = createMockAnalyticsBuilder();
    service = new LabelsService(mockAnalyticsBuilder);
    vi.clearAllMocks();
  });

  describe('getLabels', () => {
    it('should return distinct values sorted A-Z', async () => {
      const mockValues = ['Apple', 'Banana', 'Cherry'];
      mockBuildDistinctValuesQuery.mockResolvedValue(mockValues);

      const params: LabelsQueryParams = {
        column: 'brand',
      };

      const result = await service.getLabels(params);

      expect(result).toEqual({
        data: mockValues,
      });

      expect(mockBuildDistinctValuesQuery).toHaveBeenCalledWith({
        table: 'transactions',
        column: 'brand',
        filters: [],
        limit: 100,
        offset: 0,
      });
    });

    it('should apply startDate filter when provided', async () => {
      const mockValues = ['Product A', 'Product B'];
      mockBuildDistinctValuesQuery.mockResolvedValue(mockValues);

      const params: LabelsQueryParams = {
        column: 'category',
        startDate: '2024-01-01',
      };

      const result = await service.getLabels(params);

      expect(result).toEqual({
        data: mockValues,
      });

      expect(mockBuildDistinctValuesQuery).toHaveBeenCalledWith({
        table: 'transactions',
        column: 'category',
        filters: [
          {
            field: 'date',
            operator: '>=',
            value: '2024-01-01',
          },
        ],
        limit: 100,
        offset: 0,
      });
    });

    it('should apply endDate filter when provided', async () => {
      const mockValues = ['Region A'];
      mockBuildDistinctValuesQuery.mockResolvedValue(mockValues);

      const params: LabelsQueryParams = {
        column: 'region',
        endDate: '2024-12-31',
      };

      const result = await service.getLabels(params);

      expect(result).toEqual({
        data: mockValues,
      });

      expect(mockBuildDistinctValuesQuery).toHaveBeenCalledWith({
        table: 'transactions',
        column: 'region',
        filters: [
          {
            field: 'date',
            operator: '<=',
            value: '2024-12-31',
          },
        ],
        limit: 100,
        offset: 0,
      });
    });

    it('should apply both date filters when provided', async () => {
      const mockValues = ['Brand X', 'Brand Y', 'Brand Z'];
      mockBuildDistinctValuesQuery.mockResolvedValue(mockValues);

      const params: LabelsQueryParams = {
        column: 'brand',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      const result = await service.getLabels(params);

      expect(result).toEqual({
        data: mockValues,
      });

      expect(mockBuildDistinctValuesQuery).toHaveBeenCalledWith({
        table: 'transactions',
        column: 'brand',
        filters: [
          {
            field: 'date',
            operator: '>=',
            value: '2024-01-01',
          },
          {
            field: 'date',
            operator: '<=',
            value: '2024-12-31',
          },
        ],
        limit: 100,
        offset: 0,
      });
    });

    it('should handle empty results', async () => {
      mockBuildDistinctValuesQuery.mockResolvedValue([]);

      const params: LabelsQueryParams = {
        column: 'brand',
      };

      const result = await service.getLabels(params);

      expect(result).toEqual({
        data: [],
      });
    });

    it('should work with different column names', async () => {
      const mockValues = ['Seller 1', 'Seller 2'];
      mockBuildDistinctValuesQuery.mockResolvedValue(mockValues);

      const params: LabelsQueryParams = {
        column: 'seller_name',
        startDate: '2024-06-01',
      };

      const result = await service.getLabels(params);

      expect(result).toEqual({
        data: mockValues,
      });

      expect(mockBuildDistinctValuesQuery).toHaveBeenCalledWith({
        table: 'transactions',
        column: 'seller_name',
        filters: [
          {
            field: 'date',
            operator: '>=',
            value: '2024-06-01',
          },
        ],
        limit: 100,
        offset: 0,
      });
    });

    it('should apply custom limit when provided', async () => {
      const mockValues = ['A', 'B', 'C'];
      mockBuildDistinctValuesQuery.mockResolvedValue(mockValues);

      const params: LabelsQueryParams = {
        column: 'brand',
        limit: 50,
      };

      const result = await service.getLabels(params);

      expect(result).toEqual({
        data: mockValues,
      });

      expect(mockBuildDistinctValuesQuery).toHaveBeenCalledWith({
        table: 'transactions',
        column: 'brand',
        filters: [],
        limit: 50,
        offset: 0,
      });
    });

    it('should apply custom offset when provided', async () => {
      const mockValues = ['D', 'E', 'F'];
      mockBuildDistinctValuesQuery.mockResolvedValue(mockValues);

      const params: LabelsQueryParams = {
        column: 'brand',
        offset: 100,
      };

      const result = await service.getLabels(params);

      expect(result).toEqual({
        data: mockValues,
      });

      expect(mockBuildDistinctValuesQuery).toHaveBeenCalledWith({
        table: 'transactions',
        column: 'brand',
        filters: [],
        limit: 100,
        offset: 100,
      });
    });

    it('should apply both custom limit and offset', async () => {
      const mockValues = ['X', 'Y', 'Z'];
      mockBuildDistinctValuesQuery.mockResolvedValue(mockValues);

      const params: LabelsQueryParams = {
        column: 'category',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        limit: 25,
        offset: 50,
      };

      const result = await service.getLabels(params);

      expect(result).toEqual({
        data: mockValues,
      });

      expect(mockBuildDistinctValuesQuery).toHaveBeenCalledWith({
        table: 'transactions',
        column: 'category',
        filters: [
          {
            field: 'date',
            operator: '>=',
            value: '2024-01-01',
          },
          {
            field: 'date',
            operator: '<=',
            value: '2024-12-31',
          },
        ],
        limit: 25,
        offset: 50,
      });
    });
  });
});
