import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ColumnDiscoveryService } from '../../../src/core/db/clickhouse/query/column-discovery.js';
import type { ClickHouseClient } from '@clickhouse/client';

describe('ColumnDiscoveryService', () => {
  let mockClient: ClickHouseClient;
  let service: ColumnDiscoveryService;
  let mockQuery: ReturnType<typeof vi.fn>;
  let mockJson: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock ClickHouse query result
    mockJson = vi.fn();
    mockQuery = vi.fn().mockResolvedValue({
      json: mockJson,
    });

    mockClient = {
      query: mockQuery,
    } as unknown as ClickHouseClient;

    service = new ColumnDiscoveryService(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getColumnsForTables', () => {
    it('should return empty map for empty table list', async () => {
      const result = await service.getColumnsForTables([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should query database and return column map', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'date' },
        { table_name: 'dyna_transactions', column_name: 'seller_id' },
        { table_name: 'dyna_budget', column_name: 'date' },
        { table_name: 'dyna_budget', column_name: 'amount' },
      ]);

      const result = await service.getColumnsForTables(['dyna_transactions', 'dyna_budget']);

      expect(mockQuery).toHaveBeenCalledOnce();
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('dyna_transactions')).toEqual(new Set(['date', 'seller_id']));
      expect(result.get('dyna_budget')).toEqual(new Set(['date', 'amount']));
    });

    it('should cache results for repeated calls with same tables', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'date' },
      ]);

      // First call
      const result1 = await service.getColumnsForTables(['dyna_transactions']);
      expect(mockQuery).toHaveBeenCalledOnce();

      // Second call - should use cache
      const result2 = await service.getColumnsForTables(['dyna_transactions']);
      expect(mockQuery).toHaveBeenCalledOnce(); // Still only once
      expect(result2).toBe(result1); // Same reference from cache
    });

    it('should use cache even if tables are in different order', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'table1', column_name: 'col1' },
        { table_name: 'table2', column_name: 'col2' },
      ]);

      // First call with tables in one order
      await service.getColumnsForTables(['table1', 'table2']);
      expect(mockQuery).toHaveBeenCalledOnce();

      // Second call with tables in different order
      await service.getColumnsForTables(['table2', 'table1']);
      expect(mockQuery).toHaveBeenCalledOnce(); // Cache hit, no new query
    });

    it('should refresh cache after TTL expires', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'date' },
      ]);

      // First call
      await service.getColumnsForTables(['dyna_transactions']);
      expect(mockQuery).toHaveBeenCalledOnce();

      // Mock time passing (6 minutes = 360000ms, TTL is 5 minutes)
      const originalDateNow = Date.now;
      Date.now = vi.fn(() => originalDateNow() + 6 * 60 * 1000);

      // Second call after TTL - should query again
      await service.getColumnsForTables(['dyna_transactions']);
      expect(mockQuery).toHaveBeenCalledTimes(2);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should add empty set for tables with no columns', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'existing_table', column_name: 'col1' },
      ]);

      const result = await service.getColumnsForTables([
        'existing_table',
        'non_existent_table',
      ]);

      expect(result.size).toBe(2);
      expect(result.get('existing_table')).toEqual(new Set(['col1']));
      expect(result.get('non_existent_table')).toEqual(new Set()); // Empty set
    });

    it('should parameterize table names in query', async () => {
      mockJson.mockResolvedValue([]);

      await service.getColumnsForTables(['table1', 'table2', 'table3']);

      const call = mockQuery.mock.calls[0]?.[0];
      expect(call).toBeDefined();
      expect(call.query).toContain('{table_0:String}');
      expect(call.query).toContain('{table_1:String}');
      expect(call.query).toContain('{table_2:String}');
      expect(call.query_params).toEqual({
        table_0: 'table1',
        table_1: 'table2',
        table_2: 'table3',
      });
    });
  });

  describe('columnExists', () => {
    it('should return true if column exists in table', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'seller_id' },
      ]);

      const exists = await service.columnExists('dyna_transactions', 'seller_id');

      expect(exists).toBe(true);
    });

    it('should return false if column does not exist in table', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'date' },
      ]);

      const exists = await service.columnExists('dyna_transactions', 'non_existent_column');

      expect(exists).toBe(false);
    });

    it('should return false for non-existent table', async () => {
      mockJson.mockResolvedValue([]);

      const exists = await service.columnExists('non_existent_table', 'any_column');

      expect(exists).toBe(false);
    });

    it('should use cached data from previous getColumnsForTables call', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'seller_id' },
      ]);

      // Prime the cache
      await service.getColumnsForTables(['dyna_transactions']);
      expect(mockQuery).toHaveBeenCalledOnce();

      // This should use the cache
      const exists = await service.columnExists('dyna_transactions', 'seller_id');
      expect(mockQuery).toHaveBeenCalledOnce(); // No additional query
      expect(exists).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'date' },
      ]);

      // First call - cache is populated
      await service.getColumnsForTables(['dyna_transactions']);
      expect(mockQuery).toHaveBeenCalledOnce();

      // Clear cache
      service.clearCache();

      // Next call should query again since cache is cleared
      await service.getColumnsForTables(['dyna_transactions']);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('filterExistingColumns', () => {
    it('should filter columns that exist in table', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'date' },
        { table_name: 'dyna_transactions', column_name: 'seller_id' },
        { table_name: 'dyna_transactions', column_name: 'sales_price' },
      ]);

      const filtered = await service.filterExistingColumns('dyna_transactions', [
        'date',
        'seller_id',
        'non_existent_column',
        'sales_price',
        'another_missing_column',
      ]);

      expect(filtered).toEqual(['date', 'seller_id', 'sales_price']);
    });

    it('should return empty array if no columns exist', async () => {
      mockJson.mockResolvedValue([]);

      const filtered = await service.filterExistingColumns('non_existent_table', [
        'col1',
        'col2',
        'col3',
      ]);

      expect(filtered).toEqual([]);
    });

    it('should use provided column map without querying database', async () => {
      const columnMap = new Map<string, Set<string>>([
        ['dyna_transactions', new Set(['date', 'seller_id'])],
      ]);

      const filtered = await service.filterExistingColumns(
        'dyna_transactions',
        ['date', 'non_existent', 'seller_id'],
        columnMap
      );

      expect(filtered).toEqual(['date', 'seller_id']);
      expect(mockQuery).not.toHaveBeenCalled(); // No database query
    });

    it('should query database if column map not provided', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'date' },
      ]);

      const filtered = await service.filterExistingColumns('dyna_transactions', ['date']);

      expect(mockQuery).toHaveBeenCalledOnce();
      expect(filtered).toEqual(['date']);
    });

    it('should handle empty column list', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'date' },
      ]);

      const filtered = await service.filterExistingColumns('dyna_transactions', []);

      expect(filtered).toEqual([]);
    });

    it('should use cache from previous calls', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'dyna_transactions', column_name: 'date' },
        { table_name: 'dyna_transactions', column_name: 'seller_id' },
      ]);

      // Prime the cache with getColumnsForTables
      await service.getColumnsForTables(['dyna_transactions']);
      expect(mockQuery).toHaveBeenCalledOnce();

      // filterExistingColumns should use cached data
      const filtered = await service.filterExistingColumns('dyna_transactions', [
        'date',
        'seller_id',
        'non_existent',
      ]);

      expect(mockQuery).toHaveBeenCalledOnce(); // No additional query
      expect(filtered).toEqual(['date', 'seller_id']);
    });
  });

  describe('edge cases', () => {
    it('should handle duplicate rows from database', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'table1', column_name: 'col1' },
        { table_name: 'table1', column_name: 'col1' }, // Duplicate
        { table_name: 'table1', column_name: 'col2' },
      ]);

      const result = await service.getColumnsForTables(['table1']);

      expect(result.get('table1')).toEqual(new Set(['col1', 'col2'])); // Set dedupes
    });

    it('should handle special characters in table names', async () => {
      mockJson.mockResolvedValue([
        { table_name: 'table_with_underscore', column_name: 'col1' },
      ]);

      const result = await service.getColumnsForTables(['table_with_underscore']);

      expect(result.get('table_with_underscore')).toEqual(new Set(['col1']));
    });

    it('should handle large number of tables', async () => {
      const manyTables = Array.from({ length: 100 }, (_, i) => `table${i}`);
      const mockRows = manyTables.map((table) => ({
        table_name: table,
        column_name: 'col1',
      }));
      mockJson.mockResolvedValue(mockRows);

      const result = await service.getColumnsForTables(manyTables);

      expect(result.size).toBe(100);
      expect(mockQuery).toHaveBeenCalledOnce();
    });
  });
});
