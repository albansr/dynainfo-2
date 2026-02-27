import type { FilterCondition } from '../db/clickhouse/query/filter-builder.js';

/**
 * Reserved query parameters that should not be treated as filters
 */
const RESERVED_PARAMS = ['startDate', 'endDate', 'groupBy', 'page', 'limit'];

/**
 * Parse dynamic filters from query parameters
 * Accepts ANY parameter except reserved ones
 * NO field validation - ClickHouse will handle invalid columns
 *
 * @param query - Query parameters object
 * @returns Array of filter conditions
 *
 * @example
 * // Single value
 * parseDynamicFilters({ seller_id: 'S001' })
 * // Returns: [{ field: 'seller_id', operator: 'eq', value: 'S001' }]
 *
 * @example
 * // Comma-separated values
 * parseDynamicFilters({ country: 'españa,portugal' })
 * // Returns: [{ field: 'country', operator: 'in', value: ['españa', 'portugal'] }]
 *
 * @example
 * // Exclusion filter (neq operator)
 * parseDynamicFilters({ 'ProveedorComercial[neq][]': ['VERA', 'FORTE'] })
 * // Returns: [
 * //   { field: 'ProveedorComercial', operator: 'neq', value: 'VERA' },
 * //   { field: 'ProveedorComercial', operator: 'neq', value: 'FORTE' }
 * // ]
 */
export function parseDynamicFilters(
  query: Record<string, unknown>
): FilterCondition[] {
  const filters: FilterCondition[] = [];

  for (const [field, value] of Object.entries(query)) {
    // Skip reserved parameters
    if (RESERVED_PARAMS.includes(field)) {
      continue;
    }

    // Skip undefined/null values
    if (value === undefined || value === null) {
      continue;
    }

    // Check for operator syntax: field[operator][] or field[operator]
    const operatorMatch = field.match(/^(.+)\[(\w+)\](\[\])?$/);

    if (operatorMatch) {
      const fieldName = operatorMatch[1]!;
      const operator = operatorMatch[2]! as 'eq' | 'neq' | 'in';

      // Handle array values (e.g., field[neq][]=value1&field[neq][]=value2)
      if (Array.isArray(value)) {
        const stringValues = value
          .filter(v => typeof v === 'string')
          .map(v => v.trim())
          .filter(v => v !== '');

        if (stringValues.length === 0) continue;

        // For 'neq' operator, create separate filter condition for each value
        if (operator === 'neq') {
          stringValues.forEach(v => {
            filters.push({
              field: fieldName,
              operator: 'neq',
              value: v
            });
          });
        } else {
          // For other operators, use normal logic
          if (stringValues.length === 1) {
            filters.push({
              field: fieldName,
              operator,
              value: stringValues[0]!
            });
          } else {
            filters.push({
              field: fieldName,
              operator: operator === 'eq' ? 'in' : operator,
              value: stringValues
            });
          }
        }
      }
      // Handle string values
      else if (typeof value === 'string') {
        const values = value.split(',').map(v => v.trim()).filter(v => v !== '');

        if (values.length === 0) continue;

        // For 'neq' operator, create separate filter condition for each value
        if (operator === 'neq') {
          values.forEach(v => {
            filters.push({
              field: fieldName,
              operator: 'neq',
              value: v
            });
          });
        } else {
          if (values.length === 1) {
            filters.push({
              field: fieldName,
              operator,
              value: values[0]!
            });
          } else {
            filters.push({
              field: fieldName,
              operator: operator === 'eq' ? 'in' : operator,
              value: values
            });
          }
        }
      }

      continue;
    }

    // Standard field handling (no operator specified)
    // Handle string values (may be comma-separated)
    if (typeof value === 'string') {
      const values = value.split(',').map(v => v.trim()).filter(v => v !== '');

      if (values.length === 0) continue;

      if (values.length === 1) {
        // Single value: use 'eq' operator
        filters.push({
          field,
          operator: 'eq',
          value: values[0]!
        });
      } else {
        // Multiple values: use 'in' operator
        filters.push({
          field,
          operator: 'in',
          value: values
        });
      }
    }
    // Handle array values (from nested query parsing)
    else if (Array.isArray(value)) {
      const stringValues = value
        .filter(v => typeof v === 'string')
        .map(v => v.trim())
        .filter(v => v !== '');

      if (stringValues.length === 0) continue;

      if (stringValues.length === 1) {
        filters.push({
          field,
          operator: 'eq',
          value: stringValues[0]!
        });
      } else {
        filters.push({
          field,
          operator: 'in',
          value: stringValues
        });
      }
    }
  }

  return filters;
}

/**
 * Combine dynamic filters with date filters
 * Date filters are placed first to optimize query performance
 *
 * @param dynamicFilters - Filters parsed from query parameters
 * @param dateFilters - Date range filters (startDate, endDate)
 * @returns Combined array of filters
 */
export function combineFilters(
  dynamicFilters: FilterCondition[],
  dateFilters: FilterCondition[]
): FilterCondition[] {
  return [...dateFilters, ...dynamicFilters];
}
