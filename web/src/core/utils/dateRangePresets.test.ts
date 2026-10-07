import { describe, it, expect } from 'vitest';
import { calculatePresetRange, getAvailableYears, getYesterday, shouldShowCarteraBlock } from './dateRangePresets';

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

describe('shouldShowCarteraBlock', () => {
  it.each([
    ['last day of a 31-day month', new Date(2026, 0, 31)],
    ['last day of a 30-day month', new Date(2026, 3, 30)],
    ['Feb 28 of a non-leap year', new Date(2026, 1, 28)],
    ['Feb 29 of a leap year', new Date(2028, 1, 29)],
  ])('hides the block for a live period on the %s', (_label, date) => {
    expect(shouldShowCarteraBlock(date, true)).toBe(false);
  });

  it('shows the block for a live period mid-month', () => {
    expect(shouldShowCarteraBlock(new Date(2026, 9, 15), true)).toBe(true);
  });

  it('shows the block on Feb 28 of a leap year (month not yet complete)', () => {
    expect(shouldShowCarteraBlock(new Date(2028, 1, 28), true)).toBe(true);
  });

  it('keeps the block for closed periods that end on a month end (past months, years)', () => {
    expect(shouldShowCarteraBlock(new Date(2025, 11, 31), false)).toBe(true);
    expect(shouldShowCarteraBlock(new Date(2026, 8, 30), false)).toBe(true);
  });
});
