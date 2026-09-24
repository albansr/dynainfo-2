import { describe, it, expect } from 'vitest';
import { calculatePresetRange, getAvailableYears, getYesterday } from './dateRangePresets';

describe('calculatePresetRange (numeric year)', () => {
  it('spans the whole calendar year', () => {
    const { start, end } = calculatePresetRange(2024);
    expect(start.getFullYear()).toBe(2024);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(end.getFullYear()).toBe(2024);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });
});

describe('calculatePresetRange (accumulated)', () => {
  it('starts on Jan 1 of the current year', () => {
    const { start } = calculatePresetRange('accumulated');
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getFullYear()).toBe(new Date().getFullYear());
  });
});

describe('getAvailableYears', () => {
  it('lists only closed years (previous year down to 2024), excluding the current year', () => {
    const years = getAvailableYears();
    const current = getYesterday().getFullYear();
    expect(years).toContain(current - 1);
    expect(years).not.toContain(current);
    // Descending order, no future years.
    expect(years.every((y) => y < current)).toBe(true);
    expect([...years].sort((a, b) => b - a)).toEqual(years);
  });
});
