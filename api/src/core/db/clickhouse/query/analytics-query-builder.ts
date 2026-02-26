import type { ClickHouseClient } from '@clickhouse/client';
import { FilterBuilder, type FilterCondition } from './filter-builder.js';
import { MetricCalculator } from './metric-calculator.js';
import { ColumnDiscoveryService } from './column-discovery.js';
import type { MetricConfig } from './types.js';
import type { IAnalyticsQueryBuilder } from './interfaces.js';
import { getAllMetricAliases, getAllCalculatedMetricNames } from '../../../config/metrics.config.js';
import { getFieldPair } from '../../../config/dimension-fields.config.js';

/**
 * Valid fields for ORDER BY clause
 * Includes 'name' (dimension value) + all base metrics + all calculated metrics
 */
const VALID_ORDER_BY_FIELDS = [
  'name',
  ...getAllMetricAliases(),
  ...getAllCalculatedMetricNames(),
];

/**
 * Valid sort directions
 */
export type OrderDirection = 'asc' | 'desc';

/**
 * AnalyticsQueryBuilder - Orchestrates year-over-year comparison queries
 *
 * Builds optimized ClickHouse queries with CTEs for analytics and temporal comparisons.
 * Delegates filtering and calculated metrics to specialized modules.
 *
 * Architecture:
 * - Uses FilterBuilder for WHERE clauses and validation
 * - Uses MetricCalculator for calculated metrics logic
 * - Focuses on CTE construction and query orchestration
 *
 * All calculations done in ClickHouse for maximum performance.
 */
export class AnalyticsQueryBuilder implements IAnalyticsQueryBuilder {
  private client: ClickHouseClient;
  private tablePrefix: string;
  private filterBuilder: FilterBuilder;
  private metricCalculator: MetricCalculator;
  private columnDiscoveryService: ColumnDiscoveryService;

  constructor(client: ClickHouseClient) {
    this.client = client;
    this.tablePrefix = process.env['TABLE_PREFIX'] ?? '';
    this.filterBuilder = new FilterBuilder();
    this.metricCalculator = new MetricCalculator();
    this.columnDiscoveryService = new ColumnDiscoveryService(client);
  }

  /**
   * Validate orderBy field name against allowlist
   * Prevents SQL injection by only allowing predefined metric aliases and 'name'
   */
  private validateOrderByField(field: string): void {
    if (!VALID_ORDER_BY_FIELDS.includes(field)) {
      throw new Error(
        `Invalid orderBy field: ${field}. Must be one of: ${VALID_ORDER_BY_FIELDS.join(', ')}`
      );
    }
  }

  /**
   * Validate and normalize order direction
   * Only allows 'asc' or 'desc' (case-insensitive)
   */
  private validateOrderDirection(direction: string): OrderDirection {
    const normalized = direction.toLowerCase();
    if (normalized !== 'asc' && normalized !== 'desc') {
      throw new Error(`Invalid orderDirection: ${direction}. Must be 'asc' or 'desc'`);
    }
    return normalized as OrderDirection;
  }

  /**
   * Build a comprehensive year-over-year query with multiple metrics
   *
   * Returns a single row with all metrics for current period, last year, and calculations
   *
   * @param config - Query configuration
   * @returns Single row with all metrics
   */
  async buildMultiTableYoYQuery(config: {
    metrics: MetricConfig[];
    currentPeriodFilters: FilterCondition[];
  }): Promise<Record<string, number>> {
    const { metrics, currentPeriodFilters } = config;

    // Build previous year filters (shift dates by -1 year)
    const previousYearFilters = this.filterBuilder.shiftDateFilters(
      currentPeriodFilters,
      -1
    );

    // Get all table names for column discovery
    const metricsByTable = this.groupMetricsByTable(metrics);
    const tableNames = Array.from(metricsByTable.keys()).map(
      (table) => `${this.tablePrefix}${table}`
    );

    // Discover columns for all tables (single query for optimal performance)
    const columnMap = await this.columnDiscoveryService.getColumnsForTables(tableNames);

    // Build query components with table-aware filtering
    const queryParams: Record<string, string | string[]> = {};
    const { ctes, finalSelects } = this.buildQueryComponents(
      metricsByTable,
      currentPeriodFilters,
      previousYearFilters,
      queryParams,
      columnMap
    );

    // Add calculated metrics
    this.metricCalculator.addCalculatedMetrics(finalSelects, metricsByTable);

    // Build and execute final query
    const query = this.buildFinalQuery(ctes, finalSelects, metricsByTable);

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const results = await resultSet.json<Record<string, number>>();
    return results[0] ?? {};
  }

  /**
   * Build a comprehensive year-over-year query with GROUP BY
   *
   * Returns multiple rows, one per group value
   * Each row has all metrics for current period, last year, and calculations
   *
   * @param config - Query configuration with groupBy dimension and optional pagination
   * @returns Array of rows, one per group
   */
  async buildGroupedMultiTableYoYQuery(config: {
    metrics: MetricConfig[];
    currentPeriodFilters: FilterCondition[];
    groupBy: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: OrderDirection;
  }): Promise<Array<Record<string, number | string>>> {
    const {
      metrics,
      currentPeriodFilters,
      groupBy,
      limit,
      offset,
      orderBy = 'sales',
      orderDirection = 'desc',
    } = config;

    // Validate groupBy field
    this.filterBuilder.validateFieldName(groupBy);

    // Build previous year filters (shift dates by -1 year)
    const previousYearFilters = this.filterBuilder.shiftDateFilters(
      currentPeriodFilters,
      -1
    );

    // Get all table names for column discovery
    const metricsByTable = this.groupMetricsByTable(metrics);
    const tableNames = Array.from(metricsByTable.keys()).map(
      (table) => `${this.tablePrefix}${table}`
    );

    // Discover columns for all tables (single query for optimal performance)
    const columnMap = await this.columnDiscoveryService.getColumnsForTables(tableNames);

    // Build query components with GROUP BY and table-aware filtering
    const queryParams: Record<string, string | string[]> = {};
    const includeTotalCount = limit !== undefined;
    const { ctes, finalSelects, tablesWithDimension, skippedTables } = this.buildGroupedQueryComponents(
      metricsByTable,
      currentPeriodFilters,
      previousYearFilters,
      queryParams,
      columnMap,
      groupBy,
      includeTotalCount
    );

    // Add calculated metrics (pass skipped tables so formulas use literal aliases instead of CTE refs)
    this.metricCalculator.addCalculatedMetrics(finalSelects, metricsByTable, skippedTables);

    // Build and execute final query with JOINs (only for tables that have the dimension)
    const query = this.buildGroupedFinalQuery(
      ctes,
      finalSelects,
      tablesWithDimension,
      groupBy,
      limit,
      offset,
      orderBy,
      orderDirection
    );

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const results = await resultSet.json<Record<string, number | string>>();
    return Array.isArray(results) ? results : [results];
  }

  /**
   * Group metrics by table for CTE generation
   * Ensures 'transactions' is always the first table if it exists
   */
  private groupMetricsByTable(
    metrics: MetricConfig[]
  ): Map<string, MetricConfig[]> {
    // Group metrics by table
    const grouped = new Map<string, MetricConfig[]>();
    for (const metric of metrics) {
      const list = grouped.get(metric.table) ?? [];
      list.push(metric);
      grouped.set(metric.table, list);
    }

    // Sort entries: transactions first, then others
    const sorted = [...grouped.entries()].sort(([a], [b]) =>
      a === 'transactions' ? -1 : b === 'transactions' ? 1 : 0
    );

    return new Map(sorted);
  }

  /**
   * Build CTEs and SELECT clauses for non-grouped query with table-aware filtering
   */
  private buildQueryComponents(
    metricsByTable: Map<string, MetricConfig[]>,
    currentPeriodFilters: FilterCondition[],
    previousYearFilters: FilterCondition[],
    queryParams: Record<string, string | string[]>,
    columnMap: Map<string, Set<string>>
  ): { ctes: string[]; finalSelects: string[] } {
    const ctes: string[] = [];
    const finalSelects: string[] = [];

    for (const [table, tableMetrics] of metricsByTable) {
      const tableName = `${this.tablePrefix}${table}`;
      const currentCteName = `${table}_current`;
      const previousCteName = `${table}_previous`;

      // Build table-aware WHERE clauses
      const currentWhere = this.filterBuilder.buildWhereClauseForTable(
        currentPeriodFilters,
        queryParams,
        `current_${table}`,
        tableName,
        columnMap
      );
      const previousWhere = this.filterBuilder.buildWhereClauseForTable(
        previousYearFilters,
        queryParams,
        `previous_${table}`,
        tableName,
        columnMap
      );

      // Current period CTE
      const currentMetrics = tableMetrics
        .map((m) => `${m.aggregation}(${m.field}) AS ${m.alias}`)
        .join(', ');

      ctes.push(`${currentCteName} AS (
  SELECT ${currentMetrics}
  FROM ${tableName}
${currentWhere}
)`);

      // Previous year CTE
      const previousMetrics = tableMetrics
        .map((m) => `${m.aggregation}(${m.field}) AS ${m.alias}_ly`)
        .join(', ');

      ctes.push(`${previousCteName} AS (
  SELECT ${previousMetrics}
  FROM ${tableName}
${previousWhere}
)`);

      // Add selects for final query
      for (const metric of tableMetrics) {
        finalSelects.push(`${currentCteName}.${metric.alias}`);
        finalSelects.push(`${previousCteName}.${metric.alias}_ly`);
        finalSelects.push(
          `if(${previousCteName}.${metric.alias}_ly != 0, ` +
            `((${currentCteName}.${metric.alias} - ${previousCteName}.${metric.alias}_ly) / ${previousCteName}.${metric.alias}_ly) * 100, ` +
            `0) AS ${metric.alias}_vs_last_year`
        );
      }
    }

    return { ctes, finalSelects };
  }

  /**
   * Build CTEs and SELECT clauses for grouped query with table-aware filtering
   */
  private buildGroupedQueryComponents(
    metricsByTable: Map<string, MetricConfig[]>,
    currentPeriodFilters: FilterCondition[],
    previousYearFilters: FilterCondition[],
    queryParams: Record<string, string | string[]>,
    columnMap: Map<string, Set<string>>,
    groupBy: string,
    includeTotalCount = false
  ): { ctes: string[]; finalSelects: string[]; tablesWithDimension: string[]; skippedTables: Set<string> } {
    const ctes: string[] = [];
    const finalSelects: string[] = [];

    // Get field mapping for id and name
    const { idField, nameField } = getFieldPair(groupBy);

    // Determine which tables have the dimension column
    const tables = Array.from(metricsByTable.keys());
    const tablesWithDimension = tables.filter((table) => {
      const tableName = `${this.tablePrefix}${table}`;
      return columnMap.get(tableName)?.has(idField) ?? false;
    });
    const skippedTables = new Set(tables.filter((t) => !tablesWithDimension.includes(t)));

    // Build COALESCE for id field (only from tables that have the dimension)
    const idCoalesceArgs = tablesWithDimension.flatMap((table) => [
      `${table}_current.${idField}`,
      `${table}_previous.${idField}`,
    ]);
    finalSelects.push(
      `COALESCE(${idCoalesceArgs.join(', ')}) AS id`
    );

    // Build COALESCE for name field
    const nameCoalesceArgs = tablesWithDimension.flatMap((table) => [
      `${table}_current.${nameField}`,
      `${table}_previous.${nameField}`,
    ]);
    finalSelects.push(
      `COALESCE(${nameCoalesceArgs.join(', ')}) AS name`
    );

    // Add total count as window function if pagination is needed
    if (includeTotalCount) {
      finalSelects.push(`count() OVER () AS _total_count`);
    }

    for (const [table, tableMetrics] of metricsByTable) {
      const tableName = `${this.tablePrefix}${table}`;
      const currentCteName = `${table}_current`;
      const previousCteName = `${table}_previous`;
      const tableColumns = columnMap.get(tableName);
      const tableHasDimension = tableColumns?.has(idField) ?? false;

      if (tableHasDimension) {
        // Build table-aware WHERE clauses
        const currentWhere = this.filterBuilder.buildWhereClauseForTable(
          currentPeriodFilters,
          queryParams,
          `current_${table}`,
          tableName,
          columnMap
        );
        const previousWhere = this.filterBuilder.buildWhereClauseForTable(
          previousYearFilters,
          queryParams,
          `previous_${table}`,
          tableName,
          columnMap
        );

        // Current period CTE with GROUP BY
        const currentMetrics = tableMetrics
          .map((m) => `${m.aggregation}(${m.field}) AS ${m.alias}`)
          .join(', ');

        // Select both id and name fields
        // If idField === nameField (e.g., month), only select once
        const dimensionSelects = idField === nameField
          ? `trimBoth(${idField}) AS ${idField}`
          : `trimBoth(${idField}) AS ${idField}, trimBoth(${nameField}) AS ${nameField}`;

        ctes.push(`${currentCteName} AS (
  SELECT ${dimensionSelects}, ${currentMetrics}
  FROM ${tableName}
${currentWhere}
  GROUP BY ${idField === nameField ? '1' : '1, 2'}
)`);

        // Previous year CTE with GROUP BY
        const previousMetrics = tableMetrics
          .map((m) => `${m.aggregation}(${m.field}) AS ${m.alias}_ly`)
          .join(', ');

        ctes.push(`${previousCteName} AS (
  SELECT ${dimensionSelects}, ${previousMetrics}
  FROM ${tableName}
${previousWhere}
  GROUP BY ${idField === nameField ? '1' : '1, 2'}
)`);

        // Add selects for each metric
        for (const metric of tableMetrics) {
          finalSelects.push(`${currentCteName}.${metric.alias}`);
          finalSelects.push(`${previousCteName}.${metric.alias}_ly`);
          finalSelects.push(
            `if(${previousCteName}.${metric.alias}_ly != 0, ` +
              `((${currentCteName}.${metric.alias} - ${previousCteName}.${metric.alias}_ly) / ${previousCteName}.${metric.alias}_ly) * 100, ` +
              `0) AS ${metric.alias}_vs_last_year`
          );
        }
      } else {
        // Table doesn't have the dimension column — use 0 for all its metrics
        for (const metric of tableMetrics) {
          finalSelects.push(`0 AS ${metric.alias}`);
          finalSelects.push(`0 AS ${metric.alias}_ly`);
          finalSelects.push(`0 AS ${metric.alias}_vs_last_year`);
        }
      }
    }

    return { ctes, finalSelects, tablesWithDimension, skippedTables };
  }

  /**
   * Build final query without GROUP BY
   */
  private buildFinalQuery(
    ctes: string[],
    finalSelects: string[],
    metricsByTable: Map<string, MetricConfig[]>
  ): string {
    return `
WITH
${ctes.join(',\n')}
SELECT
  ${finalSelects.join(',\n  ')}
FROM ${Array.from(metricsByTable.keys()).map((t) => `${t}_current`).join(', ')}
CROSS JOIN ${Array.from(metricsByTable.keys()).map((t) => `${t}_previous`).join('\nCROSS JOIN ')}
`;
  }

  /**
   * Build final query with GROUP BY and JOINs
   * Uses LEFT JOIN to ensure only items with transactions in current period are returned
   * Supports pagination via LIMIT and OFFSET
   * Supports dynamic ordering by metric or name
   */
  private buildGroupedFinalQuery(
    ctes: string[],
    finalSelects: string[],
    tablesWithDimension: string[],
    groupBy: string,
    limit?: number,
    offset?: number,
    orderBy: string = 'sales',
    orderDirection: OrderDirection = 'desc'
  ): string {
    // Validate ordering parameters
    this.validateOrderByField(orderBy);
    const validatedDirection = this.validateOrderDirection(orderDirection);
    const firstTable = tablesWithDimension[0]; // Always 'transactions' due to groupMetricsByTable sorting
    const fromClause = `${firstTable}_current`;
    const joinClauses: string[] = [];

    // Get field mapping to know which field to use for JOINs
    const { idField } = getFieldPair(groupBy);

    // First LEFT JOIN the previous year of the first table
    joinClauses.push(
      `LEFT JOIN ${firstTable}_previous ON ${firstTable}_current.${idField} = ${firstTable}_previous.${idField}`
    );

    // Then LEFT JOIN other tables that have the dimension column
    for (const table of tablesWithDimension.slice(1)) {
      joinClauses.push(
        `LEFT JOIN ${table}_current ON ${firstTable}_current.${idField} = ${table}_current.${idField}`
      );
      joinClauses.push(
        `LEFT JOIN ${table}_previous ON ${firstTable}_current.${idField} = ${table}_previous.${idField}`
      );
    }

    // Build pagination clause if limit is provided
    const paginationClause = limit !== undefined
      ? `\nLIMIT ${limit}${offset !== undefined ? ` OFFSET ${offset}` : ''}`
      : '';

    return `
WITH
${ctes.join(',\n')}
SELECT
  ${finalSelects.join(',\n  ')}
FROM ${fromClause}
${joinClauses.join('\n')}
ORDER BY ${orderBy} ${validatedDirection.toUpperCase()}${paginationClause}
`;
  }

  /**
   * Build query to get distinct values from a column
   * Returns array of unique string values sorted alphabetically A-Z
   *
   * @param config - Configuration with table name, column, and optional filters
   * @returns Array of distinct values sorted A-Z
   */
  async buildDistinctValuesQuery(config: {
    table: string;
    column: string;
    filters: FilterCondition[];
    limit?: number;
    offset?: number;
  }): Promise<string[]> {
    const { table, column, filters, limit, offset } = config;

    // Validate column name to prevent SQL injection
    this.filterBuilder.validateFieldName(column);

    // Build table name with prefix
    const tableName = `${this.tablePrefix}${table}`;

    // Build WHERE clause directly without table-aware filtering
    // For distinct values, we apply all filters directly since we're querying a single table
    const queryParams: Record<string, string | string[]> = {};
    const conditions: string[] = [];

    filters.forEach((f, index) => {
      // Validate field name for security
      this.filterBuilder.validateFieldName(f.field);

      const paramName = `filter_${f.field}_${index}`;

      switch (f.operator) {
        case 'gte':
          queryParams[paramName] = String(f.value);
          conditions.push(`${f.field} >= {${paramName}:String}`);
          break;
        case 'lte':
          queryParams[paramName] = String(f.value);
          conditions.push(`${f.field} <= {${paramName}:String}`);
          break;
        case 'eq':
          queryParams[paramName] = String(f.value);
          conditions.push(`${f.field} = {${paramName}:String}`);
          break;
        case 'in':
          const values = Array.isArray(f.value) ? f.value : [f.value];
          queryParams[paramName] = values.map(String);
          conditions.push(`${f.field} IN {${paramName}:Array(String)}`);
          break;
        case 'gt':
          queryParams[paramName] = String(f.value);
          conditions.push(`${f.field} > {${paramName}:String}`);
          break;
        case 'lt':
          queryParams[paramName] = String(f.value);
          conditions.push(`${f.field} < {${paramName}:String}`);
          break;
        case 'neq':
          queryParams[paramName] = String(f.value);
          conditions.push(`${f.field} != {${paramName}:String}`);
          break;
      }
    });

    // Add filter for non-empty values
    conditions.push(`trimBoth(${column}) != ''`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build LIMIT/OFFSET clause
    const limitClause = limit !== undefined ? `LIMIT ${limit}` : '';
    const offsetClause = offset !== undefined && offset > 0 ? `OFFSET ${offset}` : '';
    const paginationClause = [limitClause, offsetClause].filter(c => c).join(' ');

    // Build query to get distinct values sorted A-Z, filtering out empty values
    const query = `
SELECT DISTINCT trimBoth(${column}) AS value
FROM ${tableName}
${whereClause}
ORDER BY value ASC
${paginationClause}
`;

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
      clickhouse_settings: {
        max_result_rows: '10000', // Allow up to 10k distinct values
        result_overflow_mode: 'throw',
      },
    });

    const results = await resultSet.json<{ value: string }>();

    // Return only the values (empty strings already filtered in query)
    return results.map((r) => r.value);
  }
}
