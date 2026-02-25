import type { ClickHouseClient } from '@clickhouse/client';

/**
 * Cache entry for column discovery
 */
interface ColumnCacheEntry {
  data: Map<string, Set<string>>;
  timestamp: number;
}

/**
 * Service to discover column existence in ClickHouse tables
 * Used for table-aware filtering where filters only apply to tables that have the column
 *
 * Implements caching to reduce database queries (schemas change infrequently)
 */
export class ColumnDiscoveryService {
  private cache = new Map<string, ColumnCacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private client: ClickHouseClient) {}

  /**
   * Get all columns for specified tables with caching
   * Queries ClickHouse system.columns to determine which columns exist in which tables
   *
   * Results are cached for 5 minutes to reduce database load (schemas change infrequently)
   *
   * @param tableNames - Array of table names to check (e.g., ['transactions', 'budget', 'orders'])
   * @returns Map of table name to Set of column names
   *
   * @example
   * const columnMap = await service.getColumnsForTables(['dyna_transactions', 'dyna_budget']);
   * // Returns: Map {
   * //   'dyna_transactions' => Set { 'date', 'seller_id', 'sales_price', 'aionsales_value_short_product', ... },
   * //   'dyna_budget' => Set { 'date', 'seller_id', 'amount', ... }
   * // }
   *
   * // Check if column exists in table:
   * if (columnMap.get('dyna_transactions')?.has('aionsales_value_short_product')) {
   *   // Column exists, apply filter
   * }
   */
  async getColumnsForTables(tableNames: string[]): Promise<Map<string, Set<string>>> {
    if (tableNames.length === 0) {
      return new Map();
    }

    // Create cache key from sorted table names
    const cacheKey = tableNames.slice().sort().join(',');
    const cached = this.cache.get(cacheKey);

    // Return cached result if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Query database for column information
    const result = await this.queryColumnsFromDatabase(tableNames);

    // Store in cache
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Query column information from ClickHouse system.columns
   * Separated for caching logic
   */
  private async queryColumnsFromDatabase(tableNames: string[]): Promise<Map<string, Set<string>>> {

    // Query system.columns to get all columns for specified tables
    const query = `
      SELECT
        table AS table_name,
        name AS column_name
      FROM system.columns
      WHERE database = currentDatabase()
        AND table IN (${tableNames.map((_, i) => `{table_${i}:String}`).join(', ')})
      ORDER BY table, name
    `;

    // Build query parameters
    const queryParams: Record<string, string> = {};
    tableNames.forEach((tableName, index) => {
      queryParams[`table_${index}`] = tableName;
    });

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = await resultSet.json<{ table_name: string; column_name: string }>();

    // Build Map<table, Set<columns>>
    const columnMap = new Map<string, Set<string>>();

    for (const row of rows) {
      if (!columnMap.has(row.table_name)) {
        columnMap.set(row.table_name, new Set());
      }
      columnMap.get(row.table_name)!.add(row.column_name);
    }

    // Ensure all requested tables exist in the map (even if they have no columns or don't exist)
    for (const tableName of tableNames) {
      if (!columnMap.has(tableName)) {
        columnMap.set(tableName, new Set());
      }
    }

    return columnMap;
  }

  /**
   * Check if a specific column exists in a table
   * Convenience method for single column checks
   * Uses caching from getColumnsForTables
   *
   * @param tableName - Table to check
   * @param columnName - Column to look for
   * @returns true if column exists in table
   */
  async columnExists(tableName: string, columnName: string): Promise<boolean> {
    const columnMap = await this.getColumnsForTables([tableName]);
    return columnMap.get(tableName)?.has(columnName) ?? false;
  }

  /**
   * Clear the column cache
   * Useful for testing or when schema changes are detected
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Filter a list of column names to only those that exist in a specific table
   * Useful for filtering FilterConditions before building WHERE clauses
   *
   * @param tableName - Table to check against
   * @param columnNames - Array of column names to filter
   * @param columnMap - Pre-fetched column map (if available)
   * @returns Array of column names that exist in the table
   */
  async filterExistingColumns(
    tableName: string,
    columnNames: string[],
    columnMap?: Map<string, Set<string>>
  ): Promise<string[]> {
    const map = columnMap ?? await this.getColumnsForTables([tableName]);
    const tableColumns = map.get(tableName) ?? new Set();

    return columnNames.filter(col => tableColumns.has(col));
  }
}
