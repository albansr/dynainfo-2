import { ALLOWED_DIMENSIONS } from '../../../config/dimensions.config.js';

/**
 * Filter condition structure
 */
export interface FilterCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  value: string | string[];
}

/**
 * Whitelist of allowed field names to prevent SQL injection
 * Dynamically built from config + common fields
 */
const COMMON_FIELDS = ['date', 'sales_price', 'amount'] as const;
const ALLOWED_FIELDS = [...COMMON_FIELDS, ...ALLOWED_DIMENSIONS] as const;

/**
 * Regex to validate field name format (prevents SQL injection)
 * Allows: letters, numbers, underscores
 * Must start with letter or underscore
 */
const VALID_FIELD_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Validate field name against whitelist (legacy validation)
 */
function isValidFieldName(field: string): boolean {
  return ALLOWED_FIELDS.includes(field as typeof ALLOWED_FIELDS[number]);
}

/**
 * Validate field name format (for dynamic fields)
 * More permissive than whitelist but still prevents SQL injection
 */
function isValidFieldNameFormat(field: string): boolean {
  return VALID_FIELD_NAME_REGEX.test(field);
}

/**
 * FilterBuilder - Handles filter validation and WHERE clause construction
 *
 * Responsibilities:
 * - Validate field names against whitelist (SQL injection prevention)
 * - Build parameterized WHERE clauses
 * - Shift date filters for temporal comparisons
 */
export class FilterBuilder {
  /**
   * Build WHERE clause from filters using parameterized queries
   *
   * @param filters - Array of filter conditions
   * @param queryParams - Object to accumulate query parameters
   * @param prefix - Prefix for parameter names to avoid collisions
   * @returns WHERE clause string (empty if no filters)
   */
  buildWhereClause(
    filters: FilterCondition[],
    queryParams: Record<string, string | string[]>,
    prefix: string
  ): string {
    if (filters.length === 0) return '';

    const conditions = filters.map((f, index) => {
      // Validate field name against whitelist
      if (!isValidFieldName(f.field)) {
        throw new Error(`Invalid field name: ${f.field}`);
      }

      const paramName = `${prefix}_${f.field}_${index}`;

      switch (f.operator) {
        case 'gte':
          queryParams[paramName] = String(f.value);
          return `${f.field} >= {${paramName}:String}`;
        case 'lte':
          queryParams[paramName] = String(f.value);
          return `${f.field} <= {${paramName}:String}`;
        case 'eq':
          queryParams[paramName] = String(f.value);
          return `${f.field} = {${paramName}:String}`;
        case 'in':
          const values = Array.isArray(f.value) ? f.value : [f.value];
          queryParams[paramName] = values.map(String);
          return `${f.field} IN {${paramName}:Array(String)}`;
        case 'gt':
          queryParams[paramName] = String(f.value);
          return `${f.field} > {${paramName}:String}`;
        case 'lt':
          queryParams[paramName] = String(f.value);
          return `${f.field} < {${paramName}:String}`;
        default:
          queryParams[paramName] = String(f.value);
          return `${f.field} = {${paramName}:String}`;
      }
    });

    return `WHERE ${conditions.join(' AND ')}`;
  }

  /**
   * Shift date filters by specified years for temporal comparisons
   *
   * Used for year-over-year analysis - shifts all date filters
   * by the specified number of years (typically -1 for previous year)
   *
   * @param filters - Original filter conditions
   * @param years - Number of years to shift (negative for past)
   * @returns New array of filters with shifted dates
   */
  shiftDateFilters(
    filters: FilterCondition[],
    years: number
  ): FilterCondition[] {
    return filters.map((filter) => {
      if (filter.field !== 'date' || typeof filter.value !== 'string') {
        return filter;
      }

      const date = new Date(filter.value);
      date.setFullYear(date.getFullYear() + years);

      return {
        field: filter.field,
        operator: filter.operator,
        value: date.toISOString().split('T')[0]!,
      };
    });
  }

  /**
   * Validate field name (used for GROUP BY validation)
   *
   * @param field - Field name to validate
   * @throws Error if field name is not in whitelist
   */
  validateFieldName(field: string): void {
    if (!isValidFieldName(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }
  }

  /**
   * Build WHERE clause for a specific table, filtering out columns that don't exist
   * Used for table-aware filtering where different tables have different schemas
   *
   * @param filters - Array of filter conditions
   * @param queryParams - Object to accumulate query parameters
   * @param prefix - Prefix for parameter names to avoid collisions
   * @param tableName - Name of the table to build WHERE clause for
   * @param columnMap - Map of table names to their available columns
   * @returns WHERE clause string (empty if no applicable filters)
   *
   * @example
   * // transactions has 'aionsales_value_short_product', budget doesn't
   * const filters = [
   *   { field: 'date', operator: 'gte', value: '2025-01-01' },
   *   { field: 'aionsales_value_short_product', operator: 'eq', value: 'Estrella' }
   * ];
   * const columnMap = new Map([
   *   ['dyna_transactions', new Set(['date', 'aionsales_value_short_product'])],
   *   ['dyna_budget', new Set(['date', 'amount'])]
   * ]);
   *
   * buildWhereClauseForTable(filters, {}, 'current', 'dyna_transactions', columnMap);
   * // Returns: "WHERE date >= {current_date_0:String} AND aionsales_value_short_product = {current_aionsales_value_short_product_1:String}"
   *
   * buildWhereClauseForTable(filters, {}, 'current', 'dyna_budget', columnMap);
   * // Returns: "WHERE date >= {current_date_0:String}" (aionsales_value_short_product filtered out)
   */
  buildWhereClauseForTable(
    filters: FilterCondition[],
    queryParams: Record<string, string | string[]>,
    prefix: string,
    tableName: string,
    columnMap: Map<string, Set<string>>
  ): string {
    if (filters.length === 0) return '';

    // Get columns available in this table
    const tableColumns = columnMap.get(tableName) ?? new Set<string>();

    // Filter out conditions for columns that don't exist in this table
    const applicableFilters = filters.filter(f => {
      // Validate field name format first (security)
      if (!isValidFieldNameFormat(f.field)) {
        throw new Error(`Invalid field name format: ${f.field}`);
      }

      // Special case: exclude 'channel' filter from dyna_budget table
      if (f.field === 'channel' && tableName.endsWith('budget')) {
        return false;
      }

      // Check if column exists in this table
      return tableColumns.has(f.field);
    });

    // If no applicable filters, return empty string (no WHERE clause)
    if (applicableFilters.length === 0) return '';

    // Build WHERE clause using only applicable filters
    const conditions = applicableFilters.map((f, index) => {
      const paramName = `${prefix}_${f.field}_${index}`;

      switch (f.operator) {
        case 'gte':
          queryParams[paramName] = String(f.value);
          return `${f.field} >= {${paramName}:String}`;
        case 'lte':
          queryParams[paramName] = String(f.value);
          return `${f.field} <= {${paramName}:String}`;
        case 'eq':
          queryParams[paramName] = String(f.value);
          return `${f.field} = {${paramName}:String}`;
        case 'in':
          const values = Array.isArray(f.value) ? f.value : [f.value];
          queryParams[paramName] = values.map(String);
          return `${f.field} IN {${paramName}:Array(String)}`;
        case 'gt':
          queryParams[paramName] = String(f.value);
          return `${f.field} > {${paramName}:String}`;
        case 'lt':
          queryParams[paramName] = String(f.value);
          return `${f.field} < {${paramName}:String}`;
        case 'neq':
          queryParams[paramName] = String(f.value);
          return `${f.field} != {${paramName}:String}`;
        default:
          queryParams[paramName] = String(f.value);
          return `${f.field} = {${paramName}:String}`;
      }
    });

    return `WHERE ${conditions.join(' AND ')}`;
  }
}
