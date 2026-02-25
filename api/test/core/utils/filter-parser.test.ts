import { describe, it, expect } from 'vitest';
import { parseDynamicFilters, combineFilters } from '../../../src/core/utils/filter-parser.js';
import type { FilterCondition } from '../../../src/core/db/query/interfaces.js';

describe('filter-parser', () => {
  describe('parseDynamicFilters', () => {
    it('should parse single value as eq filter', () => {
      const query = { seller_id: 'S001' };
      const filters = parseDynamicFilters(query);

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        field: 'seller_id',
        operator: 'eq',
        value: 'S001'
      });
    });

    it('should parse comma-separated values as in filter', () => {
      const query = { country: 'españa,portugal,francia' };
      const filters = parseDynamicFilters(query);

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        field: 'country',
        operator: 'in',
        value: ['españa', 'portugal', 'francia']
      });
    });

    it('should handle multiple filter fields', () => {
      const query = {
        seller_id: 'S001,S002',
        country: 'españa',
        region: 'north,south'
      };
      const filters = parseDynamicFilters(query);

      expect(filters).toHaveLength(3);
      expect(filters.find(f => f.field === 'seller_id')).toEqual({
        field: 'seller_id',
        operator: 'in',
        value: ['S001', 'S002']
      });
      expect(filters.find(f => f.field === 'country')).toEqual({
        field: 'country',
        operator: 'eq',
        value: 'españa'
      });
      expect(filters.find(f => f.field === 'region')).toEqual({
        field: 'region',
        operator: 'in',
        value: ['north', 'south']
      });
    });

    it('should skip reserved parameters', () => {
      const query = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        groupBy: 'seller_id',
        page: '1',
        limit: '50',
        seller_id: 'S001'
      };
      const filters = parseDynamicFilters(query);

      // Only seller_id should be parsed
      expect(filters).toHaveLength(1);
      expect(filters[0].field).toBe('seller_id');
    });

    it('should accept ANY field name (no validation)', () => {
      const query = {
        unknown_field: 'value1',
        another_unknown: 'value2',
        whatever_column: 'value3'
      };
      const filters = parseDynamicFilters(query);

      // All should be parsed without validation
      expect(filters).toHaveLength(3);
      expect(filters.map(f => f.field)).toContain('unknown_field');
      expect(filters.map(f => f.field)).toContain('another_unknown');
      expect(filters.map(f => f.field)).toContain('whatever_column');
    });

    it('should trim whitespace from values', () => {
      const query = { seller_id: '  S001  ,  S002  ' };
      const filters = parseDynamicFilters(query);

      expect(filters[0]).toEqual({
        field: 'seller_id',
        operator: 'in',
        value: ['S001', 'S002']
      });
    });

    it('should skip empty values after splitting', () => {
      const query = { seller_id: 'S001,,S002,' };
      const filters = parseDynamicFilters(query);

      expect(filters[0]).toEqual({
        field: 'seller_id',
        operator: 'in',
        value: ['S001', 'S002']
      });
    });

    it('should skip completely empty string values', () => {
      const query = { seller_id: '  ,  ,  ' };
      const filters = parseDynamicFilters(query);

      expect(filters).toHaveLength(0);
    });

    it('should handle array values', () => {
      const query = { seller_id: ['S001', 'S002', 'S003'] };
      const filters = parseDynamicFilters(query);

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        field: 'seller_id',
        operator: 'in',
        value: ['S001', 'S002', 'S003']
      });
    });

    it('should handle single-item array as eq filter', () => {
      const query = { seller_id: ['S001'] };
      const filters = parseDynamicFilters(query);

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        field: 'seller_id',
        operator: 'eq',
        value: 'S001'
      });
    });

    it('should skip undefined and null values', () => {
      const query = {
        seller_id: 'S001',
        undefined_field: undefined,
        null_field: null
      };
      const filters = parseDynamicFilters(query);

      expect(filters).toHaveLength(1);
      expect(filters[0].field).toBe('seller_id');
    });

    it('should handle empty query object', () => {
      const filters = parseDynamicFilters({});
      expect(filters).toHaveLength(0);
    });

    it('should handle special characters in values', () => {
      const query = { seller_id: 'ABC-001,XYZ_002' };
      const filters = parseDynamicFilters(query);

      expect(filters[0]).toEqual({
        field: 'seller_id',
        operator: 'in',
        value: ['ABC-001', 'XYZ_002']
      });
    });

    it('should handle unicode characters in values', () => {
      const query = { country: 'españa,méxico,joão' };
      const filters = parseDynamicFilters(query);

      expect(filters[0]).toEqual({
        field: 'country',
        operator: 'in',
        value: ['españa', 'méxico', 'joão']
      });
    });

    it('should filter out non-string array items', () => {
      const query = { seller_id: ['S001', 123, 'S002', null, 'S003'] as any };
      const filters = parseDynamicFilters(query);

      expect(filters[0]).toEqual({
        field: 'seller_id',
        operator: 'in',
        value: ['S001', 'S002', 'S003']
      });
    });

    it('should handle mixed reserved and non-reserved params', () => {
      const query = {
        startDate: '2025-01-01',
        seller_id: 'S001',
        endDate: '2025-12-31',
        country: 'españa',
        groupBy: 'region'
      };
      const filters = parseDynamicFilters(query);

      expect(filters).toHaveLength(2);
      expect(filters.map(f => f.field)).toContain('seller_id');
      expect(filters.map(f => f.field)).toContain('country');
      expect(filters.map(f => f.field)).not.toContain('startDate');
      expect(filters.map(f => f.field)).not.toContain('endDate');
      expect(filters.map(f => f.field)).not.toContain('groupBy');
    });

    it('should handle complex realistic scenario', () => {
      const query = {
        seller_id: 'S001,S002,S003',
        country: 'españa',
        region: 'north,south',
        status: 'active',
        startDate: '2025-01-01',
        endDate: '2025-12-31'
      };
      const filters = parseDynamicFilters(query);

      expect(filters).toHaveLength(4);
      expect(filters.find(f => f.field === 'seller_id')?.operator).toBe('in');
      expect(filters.find(f => f.field === 'country')?.operator).toBe('eq');
      expect(filters.find(f => f.field === 'region')?.operator).toBe('in');
      expect(filters.find(f => f.field === 'status')?.operator).toBe('eq');
    });

    it('should skip arrays with only empty/whitespace values', () => {
      const query = {
        field1: ['  ', '', '   '] as any,  // Array con solo valores vacíos
        field2: 'valid',
        field3: ['', '  ', 'value1', 'value2', '  '] as any  // Múltiples valores
      };

      const filters = parseDynamicFilters(query);

      // field1 debe ser ignorado (solo vacíos)
      // field2 debe incluirse (valor válido)
      // field3 debe incluirse solo con valores válidos
      expect(filters).toHaveLength(2);
      expect(filters.map(f => f.field)).toContain('field2');
      expect(filters.map(f => f.field)).toContain('field3');
      expect(filters.map(f => f.field)).not.toContain('field1');

      const field3Filter = filters.find(f => f.field === 'field3');
      expect(field3Filter?.operator).toBe('in');
      expect(field3Filter?.value).toEqual(['value1', 'value2']);
    });

    it('should skip arrays that become empty after filtering non-strings', () => {
      const query = {
        field1: [123, null, undefined, {}] as any,  // Solo valores no-string
        field2: 'valid'
      };

      const filters = parseDynamicFilters(query);

      // field1 debe ser ignorado (no hay strings válidos)
      expect(filters).toHaveLength(1);
      expect(filters[0].field).toBe('field2');
    });
  });

  describe('combineFilters', () => {
    it('should combine dynamic and date filters', () => {
      const dynamicFilters: FilterCondition[] = [
        { field: 'seller_id', operator: 'eq', value: 'S001' }
      ];
      const dateFilters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
        { field: 'date', operator: 'lte', value: '2025-12-31' }
      ];

      const combined = combineFilters(dynamicFilters, dateFilters);

      expect(combined).toHaveLength(3);
      // Date filters should come first
      expect(combined[0].field).toBe('date');
      expect(combined[1].field).toBe('date');
      expect(combined[2].field).toBe('seller_id');
    });

    it('should handle empty date filters', () => {
      const dynamicFilters: FilterCondition[] = [
        { field: 'seller_id', operator: 'eq', value: 'S001' },
        { field: 'country', operator: 'eq', value: 'españa' }
      ];
      const dateFilters: FilterCondition[] = [];

      const combined = combineFilters(dynamicFilters, dateFilters);

      expect(combined).toHaveLength(2);
      expect(combined).toEqual(dynamicFilters);
    });

    it('should handle empty dynamic filters', () => {
      const dynamicFilters: FilterCondition[] = [];
      const dateFilters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' }
      ];

      const combined = combineFilters(dynamicFilters, dateFilters);

      expect(combined).toHaveLength(1);
      expect(combined).toEqual(dateFilters);
    });

    it('should handle both empty arrays', () => {
      const combined = combineFilters([], []);
      expect(combined).toHaveLength(0);
    });

    it('should preserve filter order (date first, then dynamic)', () => {
      const dynamicFilters: FilterCondition[] = [
        { field: 'seller_id', operator: 'in', value: ['S001', 'S002'] },
        { field: 'country', operator: 'eq', value: 'españa' }
      ];
      const dateFilters: FilterCondition[] = [
        { field: 'date', operator: 'gte', value: '2025-01-01' },
        { field: 'date', operator: 'lte', value: '2025-12-31' }
      ];

      const combined = combineFilters(dynamicFilters, dateFilters);

      expect(combined[0]).toEqual(dateFilters[0]);
      expect(combined[1]).toEqual(dateFilters[1]);
      expect(combined[2]).toEqual(dynamicFilters[0]);
      expect(combined[3]).toEqual(dynamicFilters[1]);
    });
  });
});
