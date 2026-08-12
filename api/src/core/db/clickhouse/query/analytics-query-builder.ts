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
    comparisonFilters?: FilterCondition[];
    facturadoOnly?: boolean;
  }): Promise<Record<string, number>> {
    const { metrics, currentPeriodFilters, comparisonFilters, facturadoOnly = false } = config;

    // Comparison period: an explicit static range when provided (e.g. Festival),
    // otherwise the same range shifted back one year (year-over-year default).
    const previousYearFilters = comparisonFilters
      ?? this.filterBuilder.shiftDateFilters(currentPeriodFilters, -1);

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
    this.metricCalculator.addCalculatedMetrics(finalSelects, metricsByTable, undefined, facturadoOnly);

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
    comparisonFilters?: FilterCondition[];
    groupBy: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: OrderDirection;
    facturadoOnly?: boolean;
    search?: string;
  }): Promise<Array<Record<string, number | string>>> {
    const {
      metrics,
      currentPeriodFilters,
      comparisonFilters,
      groupBy,
      limit,
      offset,
      orderBy = 'sales',
      orderDirection = 'desc',
      facturadoOnly = false,
      search,
    } = config;

    // Validate groupBy field
    this.filterBuilder.validateFieldName(groupBy);

    // Comparison period: explicit static range when provided, else same range -1 year
    const previousYearFilters = comparisonFilters
      ?? this.filterBuilder.shiftDateFilters(currentPeriodFilters, -1);

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
      includeTotalCount,
      search
    );

    // Add calculated metrics (pass skipped tables so formulas use literal aliases instead of CTE refs)
    this.metricCalculator.addCalculatedMetrics(finalSelects, metricsByTable, skippedTables, facturadoOnly);

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
   * Conditions applicable to a table: unscoped ones plus those scoped to it
   * (see FilterCondition.table). `table` is the bare name, without prefix.
   */
  private filtersForTable(filters: FilterCondition[], table: string): FilterCondition[] {
    return filters.filter((f) => !f.table || f.table === table);
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
      const tableColumns = columnMap.get(tableName) ?? new Set<string>();

      // Conditions scoped to other tables do not apply here at all
      const tableCurrentFilters = this.filtersForTable(currentPeriodFilters, table);
      const tablePreviousFilters = this.filtersForTable(previousYearFilters, table);

      // If any non-date filter field is absent from this table, it can't be scoped to
      // the requested dimension → treat all its metrics as 0 (consistent with grouped query)
      const hasUnfilterableColumn = tableCurrentFilters
        .filter(f => f.field !== 'date')
        .some(f => !tableColumns.has(f.field));

      if (hasUnfilterableColumn) {
        const zeroCurrentMetrics = tableMetrics.map(m => `0 AS ${m.alias}`).join(', ');
        const zeroPreviousMetrics = tableMetrics.map(m => `0 AS ${m.alias}_ly`).join(', ');
        ctes.push(`${currentCteName} AS (SELECT ${zeroCurrentMetrics})`);
        ctes.push(`${previousCteName} AS (SELECT ${zeroPreviousMetrics})`);
      } else if (table === 'budget') {
        // Budget: expand date filter to start of month + prorate by business days
        ctes.push(this.buildBudgetCteSql({
          cteName: currentCteName, tableMetrics,
          filters: tableCurrentFilters, queryParams,
          paramPrefix: `current_${table}`, tableName, columnMap, aliasSuffix: '',
        }));
        ctes.push(this.buildBudgetCteSql({
          cteName: previousCteName, tableMetrics,
          filters: tablePreviousFilters, queryParams,
          paramPrefix: `previous_${table}`, tableName, columnMap, aliasSuffix: '_ly',
        }));
      } else {
        // Build table-aware WHERE clauses
        const currentWhere = this.filterBuilder.buildWhereClauseForTable(
          tableCurrentFilters,
          queryParams,
          `current_${table}`,
          tableName,
          columnMap
        );
        const previousWhere = this.filterBuilder.buildWhereClauseForTable(
          tablePreviousFilters,
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
      }

      // Add selects for final query
      for (const metric of tableMetrics) {
        finalSelects.push(`${currentCteName}.${metric.alias}`);
        finalSelects.push(`${previousCteName}.${metric.alias}_ly`);
        finalSelects.push(
          `if(${previousCteName}.${metric.alias}_ly > 0, ` +
            `((${currentCteName}.${metric.alias} - ${previousCteName}.${metric.alias}_ly) / ${previousCteName}.${metric.alias}_ly) * 100, ` +
            `NULL) AS ${metric.alias}_vs_last_year`
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
    includeTotalCount = false,
    search?: string
  ): { ctes: string[]; finalSelects: string[]; tablesWithDimension: string[]; skippedTables: Set<string> } {
    const ctes: string[] = [];
    const finalSelects: string[] = [];

    // Get field mapping for id and name
    const { idField, nameField } = getFieldPair(groupBy);

    // Determine which tables can contribute: they need the dimension column
    // and no filter explicitly scoped to them referencing a missing column —
    // such a filter cannot be applied, and the caller deliberately meant to
    // constrain the table (e.g. Festival excludes comprometido, which has no
    // rappel column, from rappel views). Unscoped filters keep the historical
    // drop-silently behaviour.
    const tables = Array.from(metricsByTable.keys());
    const tablesWithDimension = tables.filter((table) => {
      const tableName = `${this.tablePrefix}${table}`;
      const cols = columnMap.get(tableName);
      if (!(cols?.has(idField) ?? false)) return false;
      return !this.filtersForTable(currentPeriodFilters, table).some(
        (f) => f.table === table && !(cols?.has(f.field) ?? false)
      );
    });
    const skippedTables = new Set(tables.filter((t) => !tablesWithDimension.includes(t)));

    // Tables that also carry the display-name column. A table with only the id
    // (e.g. ppto_festival has IdRegional but not Regional) still joins and
    // aggregates by id — its name simply doesn't feed the COALESCE.
    const tableHasName = (table: string): boolean =>
      idField === nameField || (columnMap.get(`${this.tablePrefix}${table}`)?.has(nameField) ?? false);
    const tablesWithName = tablesWithDimension.filter(tableHasName);

    // The driving table (FROM clause) filters the visible groups; inject the
    // case-insensitive search predicate (id OR name) into its current CTE so
    // pagination and count() OVER() reflect the filtered set.
    const drivingTable = tablesWithDimension[0];
    const trimmedSearch = search?.trim();
    let searchPredicate = '';
    if (trimmedSearch) {
      queryParams['search_term'] = `%${trimmedSearch}%`;
      searchPredicate = idField === nameField
        ? `${idField} ILIKE {search_term:String}`
        : `(${idField} ILIKE {search_term:String} OR ${nameField} ILIKE {search_term:String})`;
    }

    // Build COALESCE for id field (only from tables that have the dimension)
    const idCoalesceArgs = tablesWithDimension.flatMap((table) => [
      `${table}_current.${idField}`,
      `${table}_previous.${idField}`,
    ]);
    finalSelects.push(
      `COALESCE(${idCoalesceArgs.join(', ')}) AS id`
    );

    // Build COALESCE for name field (only from tables that carry it)
    const nameCoalesceArgs = tablesWithName.flatMap((table) => [
      `${table}_current.${nameField}`,
      `${table}_previous.${nameField}`,
    ]);
    finalSelects.push(
      nameCoalesceArgs.length > 0
        ? `COALESCE(${nameCoalesceArgs.join(', ')}) AS name`
        : `COALESCE(${idCoalesceArgs.join(', ')}) AS name`
    );

    // Add total count as window function if pagination is needed
    if (includeTotalCount) {
      finalSelects.push(`count() OVER () AS _total_count`);
    }

    for (const [table, tableMetrics] of metricsByTable) {
      const tableName = `${this.tablePrefix}${table}`;
      const currentCteName = `${table}_current`;
      const previousCteName = `${table}_previous`;
      // Conditions scoped to other tables do not apply here at all
      const tableCurrentFilters = this.filtersForTable(currentPeriodFilters, table);
      const tablePreviousFilters = this.filtersForTable(previousYearFilters, table);

      if (tablesWithDimension.includes(table)) {
        if (table === 'budget') {
          // Budget: expand date filter to start of month + prorate by business days
          ctes.push(this.buildBudgetCteSql({
            cteName: currentCteName, tableMetrics,
            filters: tableCurrentFilters, queryParams,
            paramPrefix: `current_${table}`, tableName, columnMap, aliasSuffix: '',
            groupByConfig: { idField, nameField },
          }));
          ctes.push(this.buildBudgetCteSql({
            cteName: previousCteName, tableMetrics,
            filters: tablePreviousFilters, queryParams,
            paramPrefix: `previous_${table}`, tableName, columnMap, aliasSuffix: '_ly',
            groupByConfig: { idField, nameField },
          }));
        } else {
          // Build table-aware WHERE clauses
          let currentWhere = this.filterBuilder.buildWhereClauseForTable(
            tableCurrentFilters,
            queryParams,
            `current_${table}`,
            tableName,
            columnMap
          );
          // Inject the search predicate into the driving table's current CTE
          if (searchPredicate && table === drivingTable) {
            currentWhere = currentWhere
              ? `${currentWhere} AND ${searchPredicate}`
              : `WHERE ${searchPredicate}`;
          }
          const previousWhere = this.filterBuilder.buildWhereClauseForTable(
            tablePreviousFilters,
            queryParams,
            `previous_${table}`,
            tableName,
            columnMap
          );

          // Current period CTE with GROUP BY
          const currentMetrics = tableMetrics
            .map((m) => `${m.aggregation}(${m.field}) AS ${m.alias}`)
            .join(', ');

          // Select both id and name fields. If idField === nameField (e.g.
          // month) or the table lacks the name column, only select the id.
          const selectName = idField !== nameField && tableHasName(table);
          const dimensionSelects = selectName
            ? `trimBoth(${idField}) AS ${idField}, trimBoth(${nameField}) AS ${nameField}`
            : `trimBoth(${idField}) AS ${idField}`;

          ctes.push(`${currentCteName} AS (
  SELECT ${dimensionSelects}, ${currentMetrics}
  FROM ${tableName}
${currentWhere}
  GROUP BY ${selectName ? '1, 2' : '1'}
)`);

          // Previous year CTE with GROUP BY
          const previousMetrics = tableMetrics
            .map((m) => `${m.aggregation}(${m.field}) AS ${m.alias}_ly`)
            .join(', ');

          ctes.push(`${previousCteName} AS (
  SELECT ${dimensionSelects}, ${previousMetrics}
  FROM ${tableName}
${previousWhere}
  GROUP BY ${selectName ? '1, 2' : '1'}
)`);
        }

        // Add selects for each metric
        for (const metric of tableMetrics) {
          finalSelects.push(`${currentCteName}.${metric.alias}`);
          finalSelects.push(`${previousCteName}.${metric.alias}_ly`);
          finalSelects.push(
            `if(${previousCteName}.${metric.alias}_ly > 0, ` +
              `((${currentCteName}.${metric.alias} - ${previousCteName}.${metric.alias}_ly) / ${previousCteName}.${metric.alias}_ly) * 100, ` +
              `NULL) AS ${metric.alias}_vs_last_year`
          );
        }
      } else {
        // Table lacks the dimension column or has an inapplicable scoped
        // filter — use 0 for all its metrics
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
   * Build a budget CTE with date expansion to start of month and proration by business days.
   * Budget rows are stored on the 1st of each month. This expands the start date filter
   * to the beginning of the month and JOINs with dyna_fnc_dias_ppto to prorate by
   * business days (dias_habiles / dias_transcurridos).
   */
  private buildBudgetCteSql(config: {
    cteName: string;
    tableMetrics: MetricConfig[];
    filters: FilterCondition[];
    queryParams: Record<string, string | string[]>;
    paramPrefix: string;
    tableName: string;
    columnMap: Map<string, Set<string>>;
    aliasSuffix: string;
    groupByConfig?: { idField: string; nameField: string };
  }): string {
    const {
      cteName, tableMetrics, filters, queryParams, paramPrefix,
      tableName, columnMap, aliasSuffix, groupByConfig,
    } = config;

    const diasTable = `${this.tablePrefix}fnc_dias_ppto`;
    const startDateFilter = filters.find(f => f.field === 'date' && f.operator === 'gte')?.value;
    const endDateFilter = filters.find(f => f.field === 'date' && f.operator === 'lte')?.value;
    const isDailyView = startDateFilter && endDateFilter && startDateFilter === endDateFilter;

    const prorationFactor = isDailyView
      ? 'coalesce(1 / nullIf(d.Dias_habiles, 0), 1)'
      : 'coalesce(d.Dias_transcurridos / nullIf(d.Dias_habiles, 0), 1)';
    const tableColumns = columnMap.get(tableName) ?? new Set<string>();

    // Build WHERE conditions with date expansion for budget
    const conditions: string[] = [];

    for (let index = 0; index < filters.length; index++) {
      const f = filters[index]!;

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.field)) {
        throw new Error(`Invalid field name format: ${f.field}`);
      }

      // Skip columns that don't exist in this table
      if (!tableColumns.has(f.field)) continue;

      const paramName = `${paramPrefix}_${f.field}_${index}`;

      if (f.field === 'date' && f.operator === 'gte') {
        // Expand start date to beginning of month to capture budget rows on the 1st
        queryParams[paramName] = String(f.value);
        conditions.push(`date >= toString(toStartOfMonth(toDate({${paramName}:String})))`);
      } else if (f.operator === 'in') {
        const values = Array.isArray(f.value) ? f.value : [f.value];
        queryParams[paramName] = values.map(String);
        conditions.push(`${f.field} IN {${paramName}:Array(String)}`);
      } else {
        queryParams[paramName] = String(f.value);
        const opMap: Record<string, string> = {
          gte: '>=', lte: '<=', eq: '=', gt: '>', lt: '<', neq: '!=',
        };
        const op = opMap[f.operator] ?? '=';
        conditions.push(`${f.field} ${op} {${paramName}:String}`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build metric expressions with proration (aliases ending in "_full" keep
    // the raw, non-prorated month budget)
    const metricExprs = tableMetrics
      .map((m) => {
        const expr = m.alias.endsWith('_full')
          ? `${m.aggregation}(${m.field})`
          : `${m.aggregation}(${m.field} * ${prorationFactor})`;
        return `${expr} AS ${m.alias}${aliasSuffix}`;
      })
      .join(', ');

    // Build dimension selects and GROUP BY for grouped queries
    let dimensionSelectsPart = '';
    let groupByClause = '';
    if (groupByConfig) {
      const { idField, nameField } = groupByConfig;
      const dimensionSelects = idField === nameField
        ? `trimBoth(${idField}) AS ${idField}`
        : `trimBoth(${idField}) AS ${idField}, trimBoth(${nameField}) AS ${nameField}`;
      dimensionSelectsPart = `${dimensionSelects}, `;
      groupByClause = `\n  GROUP BY ${idField === nameField ? '1' : '1, 2'}`;
    }

    return `${cteName} AS (
  SELECT ${dimensionSelectsPart}${metricExprs}
  FROM ${tableName}
  LEFT JOIN ${diasTable} d ON toMonth(toDate(date)) = d.Mes AND toYear(toDate(date)) = d.Ano
${whereClause}${groupByClause}
)`;
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
   * Build time-series query returning sales grouped by day or month
   *
   * @param config - Filters and granularity ('day' | 'month')
   * @returns Array of { period, sales } rows sorted by period ASC
   */
  async buildTimeSeriesQuery(config: {
    filters: FilterCondition[];
    granularity: 'day' | 'month';
  }): Promise<Array<{ period: string; sales: number; budget: number }>> {
    const { filters, granularity } = config;
    const transactionsTable = `${this.tablePrefix}transactions`;
    const budgetTable = `${this.tablePrefix}budget`;
    const diasTable = `${this.tablePrefix}fnc_dias_ppto`;
    const queryParams: Record<string, string | string[]> = {};

    // Sales conditions: all filters applied normally
    const salesConditions: string[] = [];
    // Budget conditions: only date filters, with start date expanded to start of month
    const budgetConditions: string[] = [];

    for (let index = 0; index < filters.length; index++) {
      const f = filters[index]!;

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.field)) {
        throw new Error(`Invalid field name format: ${f.field}`);
      }

      const paramName = `series_${f.field}_${index}`;

      if (f.field === 'date') {
        queryParams[paramName] = String(f.value);
        const opMap: Record<string, string> = { gte: '>=', lte: '<=', eq: '=', gt: '>', lt: '<', neq: '!=' };
        const op = opMap[f.operator] ?? '=';
        salesConditions.push(`date ${op} {${paramName}:String}`);
        // Budget: expand start date to beginning of month (budget rows are on the 1st)
        if (f.operator === 'gte') {
          budgetConditions.push(`date >= toString(toStartOfMonth(toDate({${paramName}:String})))`);
        } else {
          budgetConditions.push(`date ${op} {${paramName}:String}`);
        }
      } else if (f.operator === 'in') {
        const values = Array.isArray(f.value) ? f.value : [f.value];
        queryParams[paramName] = values.map(String);
        salesConditions.push(`${f.field} IN {${paramName}:Array(String)}`);
        // Dimension filters not applied to budget (column may not exist)
      } else {
        queryParams[paramName] = String(f.value);
        const opMap: Record<string, string> = { gte: '>=', lte: '<=', eq: '=', gt: '>', lt: '<', neq: '!=' };
        const op = opMap[f.operator] ?? '=';
        salesConditions.push(`${f.field} ${op} {${paramName}:String}`);
        // Dimension filters not applied to budget (column may not exist)
      }
    }

    const salesWhere = salesConditions.length > 0 ? `WHERE ${salesConditions.join(' AND ')}` : '';
    const budgetWhere = budgetConditions.length > 0 ? `WHERE ${budgetConditions.join(' AND ')}` : '';

    let query: string;

    if (granularity === 'month') {
      // Monthly: full monthly budget per month
      query = `
WITH
sales_series AS (
  SELECT
    toString(toStartOfMonth(toDate(date))) AS period,
    sum(sales_price) AS sales
  FROM ${transactionsTable}
  ${salesWhere}
  GROUP BY period
),
budget_series AS (
  SELECT
    toString(toStartOfMonth(toDate(date))) AS period,
    sum(sales_price) AS budget
  FROM ${budgetTable}
  ${budgetWhere}
  GROUP BY period
)
SELECT
  s.period,
  s.sales,
  coalesce(b.budget, 0) AS budget
FROM sales_series s
LEFT JOIN budget_series b ON s.period = b.period
ORDER BY s.period ASC
`;
    } else {
      // Daily: budget per day = monthly_budget / Dias_habiles (same as isDailyView proration)
      query = `
WITH
sales_series AS (
  SELECT
    toString(toDate(date)) AS period,
    sum(sales_price) AS sales
  FROM ${transactionsTable}
  ${salesWhere}
  GROUP BY period
),
budget_monthly AS (
  SELECT
    toString(toStartOfMonth(toDate(date))) AS month_str,
    sum(sales_price) / nullIf(max(d.Dias_habiles), 0) AS budget_per_day
  FROM ${budgetTable}
  LEFT JOIN ${diasTable} d ON toMonth(toDate(date)) = d.Mes AND toYear(toDate(date)) = d.Ano
  ${budgetWhere}
  GROUP BY month_str
)
SELECT
  s.period,
  s.sales,
  coalesce(b.budget_per_day, 0) AS budget
FROM sales_series s
LEFT JOIN budget_monthly b ON toString(toStartOfMonth(toDate(s.period))) = b.month_str
ORDER BY s.period ASC
`;
    }

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    return resultSet.json<{ period: string; sales: number; budget: number }>();
  }

  /**
   * Build a daily value series summed across several sources, each grouped by
   * its own date column (e.g. Festival: transactions by order_date plus
   * pedidos_retenidos by date).
   *
   * Filters honour FilterCondition.table scoping. A source whose applicable
   * non-date filters reference columns it lacks contributes nothing,
   * consistent with the zeroing in buildMultiTableYoYQuery.
   */
  async buildDailySeriesQuery(config: {
    sources: Array<{ table: string; dateField: string; valueField: string }>;
    filters: FilterCondition[];
  }): Promise<Array<{ period: string; value: number }>> {
    const { sources, filters } = config;

    const tableNames = sources.map((s) => `${this.tablePrefix}${s.table}`);
    const columnMap = await this.columnDiscoveryService.getColumnsForTables(tableNames);
    const queryParams: Record<string, string | string[]> = {};

    const sourceSelects: string[] = [];
    for (const source of sources) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(source.dateField) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(source.valueField)) {
        throw new Error(`Invalid field name format: ${source.dateField} / ${source.valueField}`);
      }

      const tableName = `${this.tablePrefix}${source.table}`;
      const tableColumns = columnMap.get(tableName) ?? new Set<string>();
      const tableFilters = this.filtersForTable(filters, source.table);

      const hasUnfilterableColumn = tableFilters
        .filter((f) => f.field !== 'date')
        .some((f) => !tableColumns.has(f.field));
      if (hasUnfilterableColumn || !tableColumns.has(source.dateField) || !tableColumns.has(source.valueField)) {
        continue;
      }

      const where = this.filterBuilder.buildWhereClauseForTable(
        tableFilters,
        queryParams,
        `series_${source.table}`,
        tableName,
        columnMap
      );

      sourceSelects.push(`SELECT toString(toDate(${source.dateField})) AS period, sum(${source.valueField}) AS value
  FROM ${tableName}
  ${where}
  GROUP BY period`);
    }

    if (sourceSelects.length === 0) return [];

    const query = `
SELECT period, sum(value) AS value
FROM (
  ${sourceSelects.join('\n  UNION ALL\n  ')}
)
GROUP BY period
ORDER BY period ASC
`;

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    return resultSet.json<{ period: string; value: number }>();
  }

  /**
   * Count distinct values of a field across several tables, deduplicated
   * BETWEEN tables via UNION ALL + uniqExact (a value present in more than one
   * source counts once). Filters honour FilterCondition.table scoping; a
   * source whose applicable non-date filters reference columns it lacks
   * contributes nothing (consistent with buildMultiTableYoYQuery zeroing).
   */
  async buildDistinctCountQuery(config: {
    sources: Array<{ table: string; field: string }>;
    filters: FilterCondition[];
  }): Promise<number> {
    const { sources, filters } = config;

    const tableNames = sources.map((s) => `${this.tablePrefix}${s.table}`);
    const columnMap = await this.columnDiscoveryService.getColumnsForTables(tableNames);
    const queryParams: Record<string, string | string[]> = {};

    const sourceSelects: string[] = [];
    for (const source of sources) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(source.field)) {
        throw new Error(`Invalid field name format: ${source.field}`);
      }

      const tableName = `${this.tablePrefix}${source.table}`;
      const tableColumns = columnMap.get(tableName) ?? new Set<string>();
      const tableFilters = this.filtersForTable(filters, source.table);

      const hasUnfilterableColumn = tableFilters
        .filter((f) => f.field !== 'date')
        .some((f) => !tableColumns.has(f.field));
      if (hasUnfilterableColumn || !tableColumns.has(source.field)) {
        continue;
      }

      const where = this.filterBuilder.buildWhereClauseForTable(
        tableFilters,
        queryParams,
        `distinct_${source.table}`,
        tableName,
        columnMap
      );

      sourceSelects.push(`SELECT ${source.field} AS value FROM ${tableName} ${where}`);
    }

    if (sourceSelects.length === 0) return 0;

    const query = `
SELECT uniqExact(value) AS count
FROM (
  ${sourceSelects.join('\n  UNION ALL\n  ')}
)
`;

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = await resultSet.json<{ count: number }>();
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Distinct-count per group value: same between-table dedup as
   * buildDistinctCountQuery (UNION ALL + uniqExact), grouped by a dimension
   * column. A source lacking the dimension, the counted field, or with an
   * inapplicable non-date filter contributes nothing — consistent with the
   * zeroing in buildGroupedMultiTableYoYQuery.
   */
  async buildGroupedDistinctCountQuery(config: {
    sources: Array<{ table: string; field: string }>;
    filters: FilterCondition[];
    groupBy: string;
  }): Promise<Map<string, number>> {
    const { sources, filters, groupBy } = config;

    this.filterBuilder.validateFieldName(groupBy);

    const tableNames = sources.map((s) => `${this.tablePrefix}${s.table}`);
    const columnMap = await this.columnDiscoveryService.getColumnsForTables(tableNames);
    const queryParams: Record<string, string | string[]> = {};

    const sourceSelects: string[] = [];
    for (const source of sources) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(source.field)) {
        throw new Error(`Invalid field name format: ${source.field}`);
      }

      const tableName = `${this.tablePrefix}${source.table}`;
      const tableColumns = columnMap.get(tableName) ?? new Set<string>();
      const tableFilters = this.filtersForTable(filters, source.table);

      const hasUnfilterableColumn = tableFilters
        .filter((f) => f.field !== 'date')
        .some((f) => !tableColumns.has(f.field));
      if (hasUnfilterableColumn || !tableColumns.has(source.field) || !tableColumns.has(groupBy)) {
        continue;
      }

      const where = this.filterBuilder.buildWhereClauseForTable(
        tableFilters,
        queryParams,
        `gdistinct_${source.table}`,
        tableName,
        columnMap
      );

      // trimBoth matches the id normalization of the grouped metrics query,
      // so counts merge onto listing rows by id.
      sourceSelects.push(
        `SELECT trimBoth(${groupBy}) AS id, ${source.field} AS value FROM ${tableName} ${where}`
      );
    }

    if (sourceSelects.length === 0) return new Map();

    const query = `
SELECT id, uniqExact(value) AS count
FROM (
  ${sourceSelects.join('\n  UNION ALL\n  ')}
)
GROUP BY id
`;

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = await resultSet.json<{ id: string; count: number }>();
    return new Map(rows.map((r) => [r.id, Number(r.count)]));
  }

  /**
   * One `SELECT [trimBoth(groupBy) AS id,] field AS value FROM table WHERE …`
   * per applicable source. A source whose applicable non-date filters
   * reference columns it lacks — or that lacks the counted field / the group
   * column — contributes nothing (consistent with the distinct-count zeroing).
   */
  private buildDistinctSourceSelects(
    sources: Array<{ table: string; field: string }>,
    filters: FilterCondition[],
    columnMap: Map<string, Set<string>>,
    queryParams: Record<string, string | string[]>,
    paramPrefix: string,
    groupBy?: string
  ): string[] {
    const selects: string[] = [];
    for (const source of sources) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(source.field)) {
        throw new Error(`Invalid field name format: ${source.field}`);
      }

      const tableName = `${this.tablePrefix}${source.table}`;
      const tableColumns = columnMap.get(tableName) ?? new Set<string>();
      const tableFilters = this.filtersForTable(filters, source.table);

      const hasUnfilterableColumn = tableFilters
        .filter((f) => f.field !== 'date')
        .some((f) => !tableColumns.has(f.field));
      if (
        hasUnfilterableColumn ||
        !tableColumns.has(source.field) ||
        (groupBy && !tableColumns.has(groupBy))
      ) {
        continue;
      }

      const where = this.filterBuilder.buildWhereClauseForTable(
        tableFilters,
        queryParams,
        `${paramPrefix}_${source.table}`,
        tableName,
        columnMap
      );

      const idCol = groupBy ? `trimBoth(${groupBy}) AS id, ` : '';
      // trimBoth: pedidos_retenidos pads customer_id with spaces — untrimmed
      // values would double-count in unions and never match in exclusions.
      selects.push(`SELECT ${idCol}trimBoth(${source.field}) AS value FROM ${tableName} ${where}`);
    }
    return selects;
  }

  /**
   * Count distinct values of the universe source EXCLUDING values present in
   * any of the exclusion sources (e.g. active-year customers who did NOT buy
   * during an event window). Filters honour FilterCondition.table scoping; an
   * exclusion source with inapplicable filters excludes nothing.
   */
  async buildDistinctCountExcludingQuery(config: {
    universe: { table: string; field: string; filters: FilterCondition[] };
    exclude: { sources: Array<{ table: string; field: string }>; filters: FilterCondition[] };
  }): Promise<number> {
    const { universe, exclude } = config;

    const tableNames = [universe.table, ...exclude.sources.map((s) => s.table)].map(
      (t) => `${this.tablePrefix}${t}`
    );
    const columnMap = await this.columnDiscoveryService.getColumnsForTables(tableNames);
    const queryParams: Record<string, string | string[]> = {};

    const [universeSelect] = this.buildDistinctSourceSelects(
      [universe], universe.filters, columnMap, queryParams, 'universe'
    );
    if (!universeSelect) return 0;

    const excludeSelects = this.buildDistinctSourceSelects(
      exclude.sources, exclude.filters, columnMap, queryParams, 'exclude'
    );
    const exclusion = excludeSelects.length > 0
      ? `WHERE value NOT IN (\n  SELECT value FROM (\n  ${excludeSelects.join('\n  UNION ALL\n  ')}\n  )\n)`
      : '';

    const query = `
SELECT uniqExact(value) AS count
FROM (${universeSelect})
${exclusion}
`;

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = await resultSet.json<{ count: number }>();
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Detail listing of the distinct universe values excluded by
   * buildDistinctCountExcludingQuery: one row per key with its attribute
   * columns resolved via argMax over `dateField` (the value on the key's
   * latest universe row — e.g. a customer's current seller).
   */
  async buildDistinctDetailsExcludingQuery(config: {
    universe: { table: string; keyField: string; filters: FilterCondition[] };
    /** Attribute columns resolved per key from its most recent row. */
    attributes: string[];
    dateField: string;
    exclude: { sources: Array<{ table: string; field: string }>; filters: FilterCondition[] };
    /** Column to sort by (the key or one of the attributes). Defaults to the key. */
    orderBy?: string;
  }): Promise<Array<Record<string, string>>> {
    const { universe, attributes, dateField, exclude } = config;
    const orderBy = config.orderBy ?? universe.keyField;

    for (const field of [universe.keyField, dateField, orderBy, ...attributes]) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
        throw new Error(`Invalid field name format: ${field}`);
      }
    }

    const tableNames = [universe.table, ...exclude.sources.map((s) => s.table)].map(
      (t) => `${this.tablePrefix}${t}`
    );
    const columnMap = await this.columnDiscoveryService.getColumnsForTables(tableNames);
    const queryParams: Record<string, string | string[]> = {};

    const universeTable = `${this.tablePrefix}${universe.table}`;
    const universeColumns = columnMap.get(universeTable) ?? new Set<string>();
    const universeFilters = this.filtersForTable(universe.filters, universe.table);
    const missingColumn = [universe.keyField, dateField, ...attributes].some((f) => !universeColumns.has(f))
      || universeFilters.filter((f) => f.field !== 'date').some((f) => !universeColumns.has(f.field));
    if (missingColumn) return [];

    const where = this.filterBuilder.buildWhereClauseForTable(
      universeFilters, queryParams, 'universe_detail', universeTable, columnMap
    );

    const excludeSelects = this.buildDistinctSourceSelects(
      exclude.sources, exclude.filters, columnMap, queryParams, 'exclude_detail'
    );
    const exclusion = excludeSelects.length > 0
      ? `${where ? 'AND' : 'WHERE'} ${universe.keyField} NOT IN (\n  SELECT value FROM (\n  ${excludeSelects.join('\n  UNION ALL\n  ')}\n  )\n)`
      : '';

    const attributeCols = attributes
      .map((a) => `argMax(${a}, ${dateField}) AS ${a}`)
      .join(',\n  ');

    const query = `
SELECT
  ${universe.keyField},
  ${attributeCols}
FROM ${universeTable}
${where}
${exclusion}
GROUP BY ${universe.keyField}
ORDER BY ${orderBy} ASC
`;

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    return resultSet.json<Record<string, string>>();
  }

  /**
   * buildDistinctCountExcludingQuery grouped by a dimension column. Exclusion
   * is per (group, value) pair: a customer who bought group A during the event
   * is excluded from A but still counts in group B if they only bought B
   * before it. When the universe table lacks the group column, each group
   * falls back to the whole universe minus that group's buyers.
   */
  async buildGroupedDistinctCountExcludingQuery(config: {
    universe: { table: string; field: string; filters: FilterCondition[] };
    exclude: { sources: Array<{ table: string; field: string }>; filters: FilterCondition[] };
    groupBy: string;
  }): Promise<Map<string, number>> {
    const { universe, exclude, groupBy } = config;

    this.filterBuilder.validateFieldName(groupBy);

    const tableNames = [universe.table, ...exclude.sources.map((s) => s.table)].map(
      (t) => `${this.tablePrefix}${t}`
    );
    const columnMap = await this.columnDiscoveryService.getColumnsForTables(tableNames);
    const queryParams: Record<string, string | string[]> = {};

    const [universeSelect] = this.buildDistinctSourceSelects(
      [universe], universe.filters, columnMap, queryParams, 'guniverse', groupBy
    );

    const excludeSelects = this.buildDistinctSourceSelects(
      exclude.sources, exclude.filters, columnMap, queryParams, 'gexclude', groupBy
    );

    let query: string;
    if (universeSelect) {
      const exclusion = excludeSelects.length > 0
        ? `WHERE (id, value) NOT IN (\n  SELECT id, value FROM (\n  ${excludeSelects.join('\n  UNION ALL\n  ')}\n  )\n)`
        : '';
      query = `
SELECT id, uniqExact(value) AS count
FROM (${universeSelect})
${exclusion}
GROUP BY id
`;
    } else {
      // The universe table lacks the group column (e.g. a customer master
      // grouped by provider): each group counts the WHOLE universe minus the
      // universe members that bought that group. Groups only exist where the
      // exclusion sources saw activity — which is exactly the listing's rows.
      const [flatUniverse] = this.buildDistinctSourceSelects(
        [universe], universe.filters, columnMap, queryParams, 'guniverse'
      );
      if (!flatUniverse || excludeSelects.length === 0) return new Map();
      query = `
SELECT id,
  (SELECT uniqExact(value) FROM (${flatUniverse})) - uniqExact(value) AS count
FROM (
  ${excludeSelects.join('\n  UNION ALL\n  ')}
)
WHERE value IN (SELECT value FROM (${flatUniverse}))
GROUP BY id
`;
    }

    const resultSet = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = await resultSet.json<{ id: string; count: number }>();
    return new Map(rows.map((r) => [r.id, Number(r.count)]));
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
