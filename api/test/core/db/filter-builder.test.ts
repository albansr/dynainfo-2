import { describe, it, expect, beforeEach } from 'vitest';
import { FilterBuilder, type FilterCondition } from '../../../src/core/db/clickhouse/query/filter-builder.js';
import { ALLOWED_DIMENSIONS } from '../../../src/core/config/dimensions.config.js';

describe('FilterBuilder', () => {
  let builder: FilterBuilder;

  beforeEach(() => {
    builder = new FilterBuilder();
  });

  describe('buildWhereClause', () => {
    it('should build WHERE clause with single filter', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
      ];
      const queryParams: Record<string, string | string[]> = {};

      const whereClause = builder.buildWhereClause(filters, queryParams, 'current');

      expect(whereClause).toContain('WHERE');
      expect(whereClause).toContain('date >= {current_date_0:String}');
      expect(queryParams).toHaveProperty('current_date_0', '2025-01-01');
    });

    it('should build WHERE clause with multiple filters', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
        { field: 'date', operator: 'lte', value: '2025-12-31' },
      ];
      const queryParams: Record<string, string | string[]> = {};

      const whereClause = builder.buildWhereClause(filters, queryParams, 'current');

      expect(whereClause).toContain('WHERE');
      expect(whereClause).toContain('date >= {current_date_0:String}');
      expect(whereClause).toContain('AND date <= {current_date_1:String}');
      expect(queryParams).toHaveProperty('current_date_0', '2025-01-01');
      expect(queryParams).toHaveProperty('current_date_1', '2025-12-31');
    });

    it('should handle IN operator with array values', () => {
      const filters: FilterCondition[] = [
        { field: 'seller_id', operator: 'in', value: ['S001', 'S002'] },
      ];
      const queryParams: Record<string, string | string[]> = {};

      const whereClause = builder.buildWhereClause(filters, queryParams, 'current');

      expect(whereClause).toContain('seller_id IN {current_seller_id_0:Array(String)}');
      expect(queryParams).toHaveProperty('current_seller_id_0', ['S001', 'S002']);
    });

    it('should return empty string when no filters', () => {
      const filters: FilterCondition[] = [];
      const queryParams: Record<string, string | string[]> = {};

      const whereClause = builder.buildWhereClause(filters, queryParams, 'current');

      expect(whereClause).toBe('');
      expect(Object.keys(queryParams)).toHaveLength(0);
    });

    it('should use different parameter prefixes', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
      ];
      const queryParams: Record<string, string | string[]> = {};

      const whereClause1 = builder.buildWhereClause(filters, queryParams, 'current');
      const whereClause2 = builder.buildWhereClause(filters, queryParams, 'previous');

      expect(whereClause1).toContain('{current_date_0:String}');
      expect(whereClause2).toContain('{previous_date_0:String}');
      expect(queryParams).toHaveProperty('current_date_0');
      expect(queryParams).toHaveProperty('previous_date_0');
    });

    it('should handle all implemented comparison operators', () => {
      // Only test operators that are actually implemented in FilterBuilder
      const operators = ['eq', 'gt', 'gte', 'lt', 'lte'] as const;
      const operatorSymbols = {
        eq: '=',
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
      };

      for (const op of operators) {
        const filters: FilterCondition[] = [
          { field: 'amount', operator: op, value: '100' },
        ];
        const queryParams: Record<string, string | string[]> = {};

        const whereClause = builder.buildWhereClause(filters, queryParams, 'test');

        expect(whereClause).toContain(`amount ${operatorSymbols[op]}`);
      }
    });
  });

  describe('shiftDateFilters', () => {
    it('should shift dates by specified years', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-12-01' },
        { field: 'date', operator: 'lte', value: '2025-12-31' },
      ];

      const shifted = builder.shiftDateFilters(filters, -1);

      expect(shifted).toHaveLength(2);
      expect(shifted[0].value).toBe('2024-12-01');
      expect(shifted[1].value).toBe('2024-12-31');
    });

    it('should only shift date fields', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
        { field: 'region', operator: 'in', value: ['north'] },
      ];

      const shifted = builder.shiftDateFilters(filters, -1);

      expect(shifted[0].value).toBe('2024-01-01'); // Date shifted
      expect(shifted[1].value).toEqual(['north']); // Region unchanged
    });

    it('should handle forward shift', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2024-01-01' },
      ];

      const shifted = builder.shiftDateFilters(filters, 1);

      expect(shifted[0].value).toBe('2025-01-01');
    });

    it('should not mutate original filters', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
      ];

      const originalValue = filters[0].value;
      builder.shiftDateFilters(filters, -1);

      expect(filters[0].value).toBe(originalValue);
    });
  });

  describe('validateFieldName', () => {
    it('should allow valid field names (dynamic from config)', () => {
      // Common fields that are always allowed
      const commonFields = ['date', 'sales_price', 'amount'];

      // Dynamically read from config
      const validFields = [...commonFields, ...ALLOWED_DIMENSIONS];

      for (const field of validFields) {
        expect(() => builder.validateFieldName(field)).not.toThrow();
      }

      // Verify we're testing at least some fields
      expect(validFields.length).toBeGreaterThan(3);
    });

    it('should reject field names with SQL injection attempts', () => {
      const maliciousFields = [
        'date; DROP TABLE users;',
        'date OR 1=1',
        'date--',
        'date/*',
        'date*/',
        'date;',
        "date'",
        'date"',
        'date`',
        'date\\',
      ];

      for (const field of maliciousFields) {
        expect(() => builder.validateFieldName(field)).toThrow('Invalid field name');
      }
    });

    it('should reject empty field names', () => {
      expect(() => builder.validateFieldName('')).toThrow('Invalid field name');
    });

    it('should reject field names with whitespace', () => {
      const whitespaceFields = [
        'date ',
        ' date',
        'date\n',
        'date\t',
        'date value',
      ];

      for (const field of whitespaceFields) {
        expect(() => builder.validateFieldName(field)).toThrow('Invalid field name');
      }
    });
  });

  describe('security tests', () => {
    it('should use parameterized queries to prevent SQL injection', () => {
      const filters: FilterCondition[] = [
        { field: 'seller_id', operator: 'eq', value: "'; DROP TABLE users; --" },
      ];
      const queryParams: Record<string, string | string[]> = {};

      const whereClause = builder.buildWhereClause(filters, queryParams, 'current');

      // Should use placeholder, not inject value directly
      expect(whereClause).toContain('{current_seller_id_0:String}');
      expect(whereClause).not.toContain('DROP TABLE');

      // Malicious value should be in params (safe)
      expect(queryParams.current_seller_id_0).toBe("'; DROP TABLE users; --");
    });

    it('should handle unknown operators with default case', () => {
      // FilterBuilder uses default case for unknown operators (defaults to =)
      // This is not ideal but is the current behavior
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'neq' as any, value: '2025-01-01' },
      ];
      const queryParams: Record<string, string | string[]> = {};

      // Should not throw, falls back to = operator
      const whereClause = builder.buildWhereClause(filters, queryParams, 'current');
      expect(whereClause).toContain('date =');
    });
  });

  describe('edge cases', () => {
    it('should handle single value in IN operator', () => {
      const filters: FilterCondition[] = [
        { field: 'seller_id', operator: 'in', value: ['S001'] },
      ];
      const queryParams: Record<string, string | string[]> = {};

      const whereClause = builder.buildWhereClause(filters, queryParams, 'current');

      expect(whereClause).toContain('seller_id IN {current_seller_id_0:Array(String)}');
      expect(queryParams.current_seller_id_0).toEqual(['S001']);
    });

    it('should handle empty array in IN operator', () => {
      const filters: FilterCondition[] = [
        { field: 'seller_id', operator: 'in', value: [] },
      ];
      const queryParams: Record<string, string | string[]> = {};

      const whereClause = builder.buildWhereClause(filters, queryParams, 'current');

      expect(whereClause).toContain('seller_id IN {current_seller_id_0:Array(String)}');
      expect(queryParams.current_seller_id_0).toEqual([]);
    });

    it('should handle gt operator', () => {
      const filters: FilterCondition[] = [
        { field: 'sales_price', operator: 'gt', value: '1000' },
      ];
      const queryParams: Record<string, string | string[]> = {};

      const whereClause = builder.buildWhereClause(filters, queryParams, 'current');

      expect(whereClause).toContain('sales_price > {current_sales_price_0:String}');
      expect(queryParams.current_sales_price_0).toBe('1000');
    });

    it('should handle lt operator', () => {
      const filters: FilterCondition[] = [
        { field: 'sales_price', operator: 'lt', value: '5000' },
      ];
      const queryParams: Record<string, string | string[]> = {};

      const whereClause = builder.buildWhereClause(filters, queryParams, 'current');

      expect(whereClause).toContain('sales_price < {current_sales_price_0:String}');
      expect(queryParams.current_sales_price_0).toBe('5000');
    });
  });

  describe('buildWhereClauseForTable', () => {
    it('should filter out columns that do not exist in table', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
        { field: 'aionsales_value_short_product', operator: 'eq', value: 'Estrella' },
        { field: 'seller_id', operator: 'eq', value: 'S001' },
      ];
      const queryParams: Record<string, string | string[]> = {};
      const columnMap = new Map<string, Set<string>>([
        ['dyna_transactions', new Set(['date', 'aionsales_value_short_product', 'seller_id'])],
        ['dyna_budget', new Set(['date', 'seller_id', 'amount'])],
      ]);

      // For transactions table - should include all filters
      const transactionsWhere = builder.buildWhereClauseForTable(
        filters,
        queryParams,
        'txn',
        'dyna_transactions',
        columnMap
      );

      expect(transactionsWhere).toContain('date >=');
      expect(transactionsWhere).toContain('aionsales_value_short_product =');
      expect(transactionsWhere).toContain('seller_id =');

      // For budget table - should exclude aionsales_value_short_product
      const queryParams2: Record<string, string | string[]> = {};
      const budgetWhere = builder.buildWhereClauseForTable(
        filters,
        queryParams2,
        'bud',
        'dyna_budget',
        columnMap
      );

      expect(budgetWhere).toContain('date >=');
      expect(budgetWhere).toContain('seller_id =');
      expect(budgetWhere).not.toContain('aionsales_value_short_product');
    });

    it('should return empty string if no applicable filters', () => {
      const filters: FilterCondition[] = [
        { field: 'non_existent_column', operator: 'eq', value: 'test' },
      ];
      const queryParams: Record<string, string | string[]> = {};
      const columnMap = new Map<string, Set<string>>([
        ['dyna_transactions', new Set(['date', 'seller_id'])],
      ]);

      const whereClause = builder.buildWhereClauseForTable(
        filters,
        queryParams,
        'current',
        'dyna_transactions',
        columnMap
      );

      expect(whereClause).toBe('');
    });

    it('should return empty string for empty filter array', () => {
      const filters: FilterCondition[] = [];
      const queryParams: Record<string, string | string[]> = {};
      const columnMap = new Map<string, Set<string>>([
        ['dyna_transactions', new Set(['date'])],
      ]);

      const whereClause = builder.buildWhereClauseForTable(
        filters,
        queryParams,
        'current',
        'dyna_transactions',
        columnMap
      );

      expect(whereClause).toBe('');
    });

    it('should throw error for invalid field name format', () => {
      const filters: FilterCondition[] = [
        { field: 'malicious; DROP TABLE', operator: 'eq', value: 'test' },
      ];
      const queryParams: Record<string, string | string[]> = {};
      const columnMap = new Map<string, Set<string>>([
        ['dyna_transactions', new Set(['malicious; DROP TABLE'])],
      ]);

      expect(() => {
        builder.buildWhereClauseForTable(
          filters,
          queryParams,
          'current',
          'dyna_transactions',
          columnMap
        );
      }).toThrow('Invalid field name format');
    });

    it('should handle table not in column map', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'eq', value: '2025-01-01' },
      ];
      const queryParams: Record<string, string | string[]> = {};
      const columnMap = new Map<string, Set<string>>([
        ['dyna_transactions', new Set(['date'])],
      ]);

      // Query for table not in map
      const whereClause = builder.buildWhereClauseForTable(
        filters,
        queryParams,
        'current',
        'non_existent_table',
        columnMap
      );

      expect(whereClause).toBe(''); // No columns available, no filters
    });

    it('should handle all operators in table-aware mode', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
        { field: 'sales_price', operator: 'lte', value: '1000' },
        { field: 'seller_id', operator: 'in', value: ['S001', 'S002'] },
        { field: 'sales_amount', operator: 'gt', value: '500' },
        { field: 'quantity', operator: 'lt', value: '100' },
        { field: 'IdRegional', operator: 'neq', value: 'R999' },
      ];
      const queryParams: Record<string, string | string[]> = {};
      const columnMap = new Map<string, Set<string>>([
        ['test_table', new Set(['date', 'sales_price', 'seller_id', 'sales_amount', 'quantity', 'IdRegional'])],
      ]);

      const whereClause = builder.buildWhereClauseForTable(
        filters,
        queryParams,
        'current',
        'test_table',
        columnMap
      );

      expect(whereClause).toContain('date >=');
      expect(whereClause).toContain('sales_price <=');
      expect(whereClause).toContain('seller_id IN');
      expect(whereClause).toContain('sales_amount >');
      expect(whereClause).toContain('quantity <');
      expect(whereClause).toContain('IdRegional !=');
    });

    it('should fallback to equals operator for unknown operators in buildWhereClauseForTable', () => {
      const filters: FilterCondition[] = [
        { field: 'date', operator: 'unknown_operator' as any, value: '2025-01-01' },
      ];
      const queryParams: Record<string, string | string[]> = {};
      const columnMap = new Map<string, Set<string>>([
        ['dyna_transactions', new Set(['date'])],
      ]);

      const whereClause = builder.buildWhereClauseForTable(
        filters,
        queryParams,
        'current',
        'dyna_transactions',
        columnMap
      );

      // Should fallback to = operator for unknown operators
      expect(whereClause).toContain('date = {current_date_0:String}');
      expect(queryParams.current_date_0).toBe('2025-01-01');
    });

    it('should handle eq operator explicitly in buildWhereClauseForTable', () => {
      const filters: FilterCondition[] = [
        { field: 'seller_id', operator: 'eq', value: 'S001' },
      ];
      const queryParams: Record<string, string | string[]> = {};
      const columnMap = new Map<string, Set<string>>([
        ['dyna_transactions', new Set(['seller_id'])],
      ]);

      const whereClause = builder.buildWhereClauseForTable(
        filters,
        queryParams,
        'current',
        'dyna_transactions',
        columnMap
      );

      expect(whereClause).toContain('seller_id = {current_seller_id_0:String}');
      expect(queryParams.current_seller_id_0).toBe('S001');
    });
  });
});
