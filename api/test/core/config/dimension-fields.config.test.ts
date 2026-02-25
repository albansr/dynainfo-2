import { describe, it, expect } from 'vitest';
import { getFieldPair, hasNameField } from '../../../src/core/config/dimension-fields.config.js';

describe('dimension-fields.config', () => {
  describe('getFieldPair', () => {
    it('should return correct field pair for customer_id', () => {
      const result = getFieldPair('customer_id');
      expect(result).toEqual({
        idField: 'customer_id',
        nameField: 'customer_name',
      });
    });

    it('should return correct field pair for product_id', () => {
      const result = getFieldPair('product_id');
      expect(result).toEqual({
        idField: 'product_id',
        nameField: 'product_name',
      });
    });

    it('should return correct field pair for seller_id', () => {
      const result = getFieldPair('seller_id');
      expect(result).toEqual({
        idField: 'seller_id',
        nameField: 'seller_name',
      });
    });

    it('should return same field for id and name when no mapping exists', () => {
      const result = getFieldPair('month');
      expect(result).toEqual({
        idField: 'month',
        nameField: 'month',
      });
    });

    it('should return same field for id and name for IdRegional', () => {
      const result = getFieldPair('IdRegional');
      expect(result).toEqual({
        idField: 'IdRegional',
        nameField: 'IdRegional',
      });
    });

    it('should return same field for id and name for quarter', () => {
      const result = getFieldPair('quarter');
      expect(result).toEqual({
        idField: 'quarter',
        nameField: 'quarter',
      });
    });

    it('should return same field for id and name for year', () => {
      const result = getFieldPair('year');
      expect(result).toEqual({
        idField: 'year',
        nameField: 'year',
      });
    });

    it('should return same field for unknown dimensions', () => {
      const result = getFieldPair('unknown_dimension');
      expect(result).toEqual({
        idField: 'unknown_dimension',
        nameField: 'unknown_dimension',
      });
    });
  });

  describe('hasNameField', () => {
    it('should return true for customer_id', () => {
      expect(hasNameField('customer_id')).toBe(true);
    });

    it('should return true for product_id', () => {
      expect(hasNameField('product_id')).toBe(true);
    });

    it('should return true for seller_id', () => {
      expect(hasNameField('seller_id')).toBe(true);
    });

    it('should return false for month', () => {
      expect(hasNameField('month')).toBe(false);
    });

    it('should return false for quarter', () => {
      expect(hasNameField('quarter')).toBe(false);
    });

    it('should return false for year', () => {
      expect(hasNameField('year')).toBe(false);
    });

    it('should return false for IdRegional', () => {
      expect(hasNameField('IdRegional')).toBe(false);
    });

    it('should return false for unknown dimensions', () => {
      expect(hasNameField('unknown_dimension')).toBe(false);
    });
  });
});
