import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListService } from '../../../src/features/list/list.service.js';
import type { IAnalyticsQueryBuilder, FilterCondition } from '../../../src/core/db/clickhouse/query/interfaces.js';
import type { ListQueryParams } from '../../../src/features/list/list.schemas.js';
import { generateMockQueryResult } from '../../helpers/test-data-builder.js';

describe('ListService', () => {
  let service: ListService;
  let mockBuilder: IAnalyticsQueryBuilder;

  beforeEach(() => {
    mockBuilder = {
      buildMultiTableYoYQuery: vi.fn(),
      buildGroupedMultiTableYoYQuery: vi.fn(),
    } as IAnalyticsQueryBuilder;

    service = new ListService(mockBuilder);
  });

  describe('getBalanceList', () => {
    it('should return list with items containing name and metrics', async () => {
      const mockResults = [
        { name: 'Region A', ...generateMockQueryResult() },
        { name: 'Region B', ...generateMockQueryResult() },
      ];

      vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

      const params: ListQueryParams = {
        groupBy: 'IdRegional',
      };

      const result = await service.getBalanceList(params);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Region A');
      expect(result.data[1].name).toBe('Region B');
      expect(result.meta.groupBy).toBe('IdRegional');
      expect(result.meta.count).toBe(2);
    });

    it('should replace empty name with "Sin Determinar"', async () => {
      const mockResults = [
        { name: '', ...generateMockQueryResult() },
        { name: '   ', ...generateMockQueryResult() }, // whitespace only
        { name: 'Valid Name', ...generateMockQueryResult() },
      ];

      vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

      const params: ListQueryParams = {
        groupBy: 'IdRegional',
      };

      const result = await service.getBalanceList(params);

      expect(result.data).toHaveLength(3);
      expect(result.data[0].name).toBe('Sin Determinar');
      expect(result.data[1].name).toBe('Sin Determinar');
      expect(result.data[2].name).toBe('Valid Name');
    });

    it('should handle null name as "Sin Determinar"', async () => {
      const mockResults = [
        { name: null, ...generateMockQueryResult() },
      ];

      vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

      const params: ListQueryParams = {
        groupBy: 'IdRegional',
      };

      const result = await service.getBalanceList(params);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Sin Determinar');
    });

    it('should handle undefined name as "Sin Determinar"', async () => {
      const mockResults = [
        { name: undefined, ...generateMockQueryResult() },
      ];

      vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

      const params: ListQueryParams = {
        groupBy: 'IdRegional',
      };

      const result = await service.getBalanceList(params);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Sin Determinar');
    });

    it('should preserve names with leading/trailing spaces after trim', async () => {
      const mockResults = [
        { name: '  Valid Name  ', ...generateMockQueryResult() },
      ];

      vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

      const params: ListQueryParams = {
        groupBy: 'IdRegional',
      };

      const result = await service.getBalanceList(params);

      expect(result.data).toHaveLength(1);
      // Should keep the name as-is (with spaces) since trim() is only used for checking emptiness
      expect(result.data[0].name).toBe('  Valid Name  ');
    });

    it('should pass filters and groupBy to analytics builder', async () => {
      const mockResults = [
        { name: 'Test', ...generateMockQueryResult() },
      ];

      vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

      const params: ListQueryParams = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        groupBy: 'IdRegional',
      };

      await service.getBalanceList(params);

      expect(mockBuilder.buildGroupedMultiTableYoYQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          groupBy: 'IdRegional',
          currentPeriodFilters: expect.arrayContaining([
            expect.objectContaining({ field: 'date', operator: 'gte', value: '2025-01-01' }),
            expect.objectContaining({ field: 'date', operator: 'lte', value: '2025-12-31' }),
          ]),
        })
      );
    });

    it('should handle empty results array', async () => {
      vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue([]);

      const params: ListQueryParams = {
        groupBy: 'IdRegional',
      };

      const result = await service.getBalanceList(params);

      expect(result.data).toHaveLength(0);
      expect(result.meta.count).toBe(0);
      expect(result.meta.groupBy).toBe('IdRegional');
    });

    it('should be dynamic and adapt to config changes', async () => {
      // This test verifies that adding new metrics to config doesn't break list service
      const mockResults = [
        { name: 'Test', ...generateMockQueryResult() },
      ];

      vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

      const params: ListQueryParams = {
        groupBy: 'IdRegional',
      };

      const result = await service.getBalanceList(params);

      // Should have name field
      expect(result.data[0]).toHaveProperty('name');

      // Should have all base metrics (dynamic based on config)
      expect(result.data[0]).toHaveProperty('sales');
      expect(result.data[0]).toHaveProperty('budget');
      expect(result.data[0]).toHaveProperty('orders');
    });

    describe('pagination', () => {
      it('should use default pagination values (page=1, limit=50)', async () => {
        // Mock first page (50 items) with _total_count from window function
        const pageMockResults = Array.from({ length: 50 }, (_, i) => ({
          name: `Item ${i + 1}`,
          _total_count: 150, // Window function returns total count in each row
          ...generateMockQueryResult(),
        }));

        vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery)
          .mockResolvedValueOnce(pageMockResults);

        const params: ListQueryParams = {
          groupBy: 'IdRegional',
        };

        const result = await service.getBalanceList(params);

        // Verify metadata
        expect(result.meta.total).toBe(150);
        expect(result.meta.count).toBe(50);
        expect(result.meta.page).toBe(1);
        expect(result.meta.limit).toBe(50);
        expect(result.meta.totalPages).toBe(3);

        // Verify _total_count is not exposed in response items
        expect(result.data[0]).not.toHaveProperty('_total_count');

        // Verify single call with pagination
        expect(mockBuilder.buildGroupedMultiTableYoYQuery).toHaveBeenCalledTimes(1);
        expect(mockBuilder.buildGroupedMultiTableYoYQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 50,
            offset: 0,
          })
        );
      });

      it('should handle custom page and limit values', async () => {
        // Mock page 3 with limit 20 (items 41-60) with _total_count
        const pageMockResults = Array.from({ length: 20 }, (_, i) => ({
          name: `Item ${i + 41}`,
          _total_count: 100,
          ...generateMockQueryResult(),
        }));

        vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery)
          .mockResolvedValueOnce(pageMockResults);

        const params: ListQueryParams = {
          groupBy: 'IdRegional',
          page: 3,
          limit: 20,
        };

        const result = await service.getBalanceList(params);

        // Verify metadata
        expect(result.meta.total).toBe(100);
        expect(result.meta.count).toBe(20);
        expect(result.meta.page).toBe(3);
        expect(result.meta.limit).toBe(20);
        expect(result.meta.totalPages).toBe(5);

        // Verify correct offset calculation: (page - 1) * limit = (3 - 1) * 20 = 40
        expect(mockBuilder.buildGroupedMultiTableYoYQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 20,
            offset: 40,
          })
        );
      });

      it('should calculate correct total pages with remainder', async () => {
        // 47 total results with limit 20 should give 3 pages (20 + 20 + 7)
        const pageMockResults = Array.from({ length: 20 }, (_, i) => ({
          name: `Item ${i + 1}`,
          _total_count: 47,
          ...generateMockQueryResult(),
        }));

        vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery)
          .mockResolvedValueOnce(pageMockResults);

        const params: ListQueryParams = {
          groupBy: 'IdRegional',
          page: 1,
          limit: 20,
        };

        const result = await service.getBalanceList(params);

        expect(result.meta.totalPages).toBe(3); // Math.ceil(47 / 20) = 3
      });

      it('should handle last page with fewer items than limit', async () => {
        // 95 total results, requesting page 5 with limit 20
        // Last page has only 15 items (items 81-95)
        const pageMockResults = Array.from({ length: 15 }, (_, i) => ({
          name: `Item ${i + 81}`,
          _total_count: 95,
          ...generateMockQueryResult(),
        }));

        vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery)
          .mockResolvedValueOnce(pageMockResults);

        const params: ListQueryParams = {
          groupBy: 'IdRegional',
          page: 5,
          limit: 20,
        };

        const result = await service.getBalanceList(params);

        expect(result.meta.total).toBe(95);
        expect(result.meta.count).toBe(15); // Actual items in last page
        expect(result.meta.totalPages).toBe(5);
        expect(result.meta.page).toBe(5);
      });

      it('should handle empty results with pagination', async () => {
        vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery)
          .mockResolvedValueOnce([]);

        const params: ListQueryParams = {
          groupBy: 'IdRegional',
          page: 1,
          limit: 50,
        };

        const result = await service.getBalanceList(params);

        expect(result.meta.total).toBe(0);
        expect(result.meta.count).toBe(0);
        expect(result.meta.totalPages).toBe(0);
      });

      it('should handle single page of results', async () => {
        // 30 total results with limit 50 = 1 page
        const mockResults = Array.from({ length: 30 }, (_, i) => ({
          name: `Item ${i + 1}`,
          _total_count: 30,
          ...generateMockQueryResult(),
        }));

        vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery)
          .mockResolvedValueOnce(mockResults);

        const params: ListQueryParams = {
          groupBy: 'IdRegional',
          page: 1,
          limit: 50,
        };

        const result = await service.getBalanceList(params);

        expect(result.meta.total).toBe(30);
        expect(result.meta.count).toBe(30);
        expect(result.meta.totalPages).toBe(1);
      });
    });

    describe('dynamic filters', () => {
      it('should pass dynamic filters directly to analytics builder', async () => {
        const mockResults = [
          { name: 'Test', _total_count: 1, ...generateMockQueryResult() }
        ];
        vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

        const filters: FilterCondition[] = [
          { field: 'date', operator: 'gte', value: '2025-01-01' },
          { field: 'seller_id', operator: 'eq', value: 'S001' },
          { field: 'region', operator: 'in', value: ['north', 'south'] }
        ];

        await service.getBalanceList({
          groupBy: 'seller_id',
          filters
        });

        expect(mockBuilder.buildGroupedMultiTableYoYQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            currentPeriodFilters: filters
          })
        );
      });

      it('should combine dynamic filters with pagination', async () => {
        const mockResults = Array.from({ length: 20 }, (_, i) => ({
          name: `Item ${i + 1}`,
          _total_count: 100,
          ...generateMockQueryResult(),
        }));

        vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

        const filters: FilterCondition[] = [
          { field: 'country', operator: 'eq', value: 'españa' },
          { field: 'status', operator: 'in', value: ['active', 'pending'] }
        ];

        await service.getBalanceList({
          groupBy: 'IdRegional',
          page: 2,
          limit: 20,
          filters
        });

        expect(mockBuilder.buildGroupedMultiTableYoYQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            currentPeriodFilters: filters,
            limit: 20,
            offset: 20  // page 2
          })
        );
      });

      it('should handle empty filters array', async () => {
        const mockResults = [
          { name: 'Test', _total_count: 1, ...generateMockQueryResult() }
        ];
        vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

        await service.getBalanceList({
          groupBy: 'seller_id',
          filters: []
        });

        expect(mockBuilder.buildGroupedMultiTableYoYQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            currentPeriodFilters: []
          })
        );
      });

      it('should still work without filters for backward compatibility', async () => {
        const mockResults = [
          { name: 'Test', _total_count: 1, ...generateMockQueryResult() }
        ];
        vi.mocked(mockBuilder.buildGroupedMultiTableYoYQuery).mockResolvedValue(mockResults);

        await service.getBalanceList({
          groupBy: 'seller_id',
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        });

        expect(mockBuilder.buildGroupedMultiTableYoYQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            currentPeriodFilters: [
              { field: 'date', operator: 'gte', value: '2025-01-01' },
              { field: 'date', operator: 'lte', value: '2025-12-31' }
            ]
          })
        );
      });
    });
  });
});
