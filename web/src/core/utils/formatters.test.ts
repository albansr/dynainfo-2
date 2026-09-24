import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercentage, formatPercentageWithSign } from './formatters';

describe('formatCurrency', () => {
  it('groups thousands and drops decimals', () => {
    expect(formatCurrency(1234567)).toBe('1.234.567');
    expect(formatCurrency(0)).toBe('0');
  });
});

describe('formatPercentage', () => {
  it('always shows two decimals', () => {
    expect(formatPercentage(6.27)).toBe('6,27');
    expect(formatPercentage(100)).toBe('100,00');
  });
});

describe('formatPercentageWithSign', () => {
  it('prefixes + only for positive values', () => {
    expect(formatPercentageWithSign(6.27)).toBe('+6,27');
    expect(formatPercentageWithSign(-2.5)).toBe('-2,50');
    expect(formatPercentageWithSign(0)).toBe('0,00');
  });
});
