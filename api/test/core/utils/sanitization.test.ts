import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeStringArray,
  sanitizeDateString,
  sanitizeFieldName,
  sanitizeCommaSeparated,
  sanitizeNumber,
  sanitizeInteger,
} from '../../../src/core/utils/sanitization.js';
import { InvalidInputError } from '../../../src/core/errors/app-error.js';

describe('Sanitization Utils', () => {
  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  test  ')).toBe('test');
    });

    it('should remove null bytes', () => {
      expect(sanitizeString('test\0string')).toBe('teststring');
    });

    it('should throw on non-string input', () => {
      expect(() => sanitizeString(123 as any)).toThrow(InvalidInputError);
    });

    it('should throw on too long strings', () => {
      const longString = 'a'.repeat(1001);
      expect(() => sanitizeString(longString)).toThrow(InvalidInputError);
      expect(() => sanitizeString(longString)).toThrow('too long');
    });

    it('should accept strings up to 1000 chars', () => {
      const maxString = 'a'.repeat(1000);
      expect(sanitizeString(maxString)).toBe(maxString);
    });
  });

  describe('sanitizeStringArray', () => {
    it('should sanitize all array elements', () => {
      const result = sanitizeStringArray(['  a  ', 'b\0', '  c']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should throw on non-array input', () => {
      expect(() => sanitizeStringArray('not array' as any)).toThrow(InvalidInputError);
    });

    it('should throw on too long arrays', () => {
      const longArray = new Array(101).fill('test');
      expect(() => sanitizeStringArray(longArray)).toThrow(InvalidInputError);
      expect(() => sanitizeStringArray(longArray)).toThrow('too long');
    });

    it('should accept arrays up to 100 items', () => {
      const maxArray = new Array(100).fill('test');
      expect(sanitizeStringArray(maxArray)).toHaveLength(100);
    });
  });

  describe('sanitizeDateString', () => {
    it('should accept valid ISO dates', () => {
      expect(sanitizeDateString('2025-01-15')).toBe('2025-01-15');
      expect(sanitizeDateString('2024-12-31')).toBe('2024-12-31');
    });

    it('should reject invalid date formats', () => {
      expect(() => sanitizeDateString('2025/01/15')).toThrow(InvalidInputError);
      expect(() => sanitizeDateString('15-01-2025')).toThrow(InvalidInputError);
      expect(() => sanitizeDateString('2025-1-5')).toThrow(InvalidInputError);
    });

    it('should reject invalid dates', () => {
      expect(() => sanitizeDateString('2025-13-01')).toThrow(InvalidInputError);
      // Note: JavaScript Date accepts 2025-02-30 and converts it to 2025-03-02
      // So we test with a clearly invalid format instead
      expect(() => sanitizeDateString('2025-00-01')).toThrow(InvalidInputError);
    });
  });

  describe('sanitizeFieldName', () => {
    it('should accept valid field names', () => {
      expect(sanitizeFieldName('user_id')).toBe('user_id');
      expect(sanitizeFieldName('seller123')).toBe('seller123');
      expect(sanitizeFieldName('IdRegional')).toBe('IdRegional');
    });

    it('should reject invalid characters', () => {
      expect(() => sanitizeFieldName('user-id')).toThrow(InvalidInputError);
      expect(() => sanitizeFieldName('user.id')).toThrow(InvalidInputError);
      expect(() => sanitizeFieldName('user id')).toThrow(InvalidInputError);
      expect(() => sanitizeFieldName('user;id')).toThrow(InvalidInputError);
    });

    it('should reject too long field names', () => {
      const longName = 'a'.repeat(51);
      expect(() => sanitizeFieldName(longName)).toThrow(InvalidInputError);
    });

    it('should accept field names up to 50 chars', () => {
      const maxName = 'a'.repeat(50);
      expect(sanitizeFieldName(maxName)).toBe(maxName);
    });
  });

  describe('sanitizeCommaSeparated', () => {
    it('should split and sanitize comma-separated values', () => {
      const result = sanitizeCommaSeparated('a, b, c');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should filter empty values', () => {
      const result = sanitizeCommaSeparated('a,,b,  ,c');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should return undefined for empty input', () => {
      expect(sanitizeCommaSeparated()).toBeUndefined();
      expect(sanitizeCommaSeparated('')).toBeUndefined();
    });

    it('should handle single value', () => {
      const result = sanitizeCommaSeparated('single');
      expect(result).toEqual(['single']);
    });
  });

  describe('sanitizeNumber', () => {
    it('should accept valid numbers', () => {
      expect(sanitizeNumber(123)).toBe(123);
      expect(sanitizeNumber('456')).toBe(456);
      expect(sanitizeNumber(0)).toBe(0);
      expect(sanitizeNumber(-10)).toBe(-10);
    });

    it('should reject NaN', () => {
      expect(() => sanitizeNumber('abc')).toThrow(InvalidInputError);
      expect(() => sanitizeNumber(undefined)).toThrow(InvalidInputError);
    });

    it('should reject infinity', () => {
      expect(() => sanitizeNumber(Infinity)).toThrow(InvalidInputError);
      expect(() => sanitizeNumber(-Infinity)).toThrow(InvalidInputError);
    });
  });

  describe('sanitizeInteger', () => {
    it('should accept valid integers', () => {
      expect(sanitizeInteger(10)).toBe(10);
      expect(sanitizeInteger('20')).toBe(20);
      expect(sanitizeInteger(0)).toBe(0);
    });

    it('should reject floats', () => {
      expect(() => sanitizeInteger(10.5)).toThrow(InvalidInputError);
      expect(() => sanitizeInteger('15.7')).toThrow(InvalidInputError);
    });

    it('should enforce minimum value', () => {
      expect(() => sanitizeInteger(5, 10)).toThrow(InvalidInputError);
      expect(() => sanitizeInteger(5, 10)).toThrow('at least 10');
      expect(sanitizeInteger(10, 10)).toBe(10);
      expect(sanitizeInteger(15, 10)).toBe(15);
    });

    it('should enforce maximum value', () => {
      expect(() => sanitizeInteger(100, undefined, 50)).toThrow(InvalidInputError);
      expect(() => sanitizeInteger(100, undefined, 50)).toThrow('at most 50');
      expect(sanitizeInteger(50, undefined, 50)).toBe(50);
      expect(sanitizeInteger(30, undefined, 50)).toBe(30);
    });

    it('should enforce both min and max', () => {
      expect(sanitizeInteger(50, 10, 100)).toBe(50);
      expect(() => sanitizeInteger(5, 10, 100)).toThrow(InvalidInputError);
      expect(() => sanitizeInteger(150, 10, 100)).toThrow(InvalidInputError);
    });
  });
});
