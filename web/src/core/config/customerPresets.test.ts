import { describe, it, expect } from 'vitest';
import {
  toCustomerPreset,
  DEFAULT_CUSTOMER_PRESET,
  CUSTOMER_PRESETS,
  CUSTOMER_PRESET_OPTIONS,
} from './customerPresets';

describe('toCustomerPreset', () => {
  it('accepts every valid preset id', () => {
    for (const preset of CUSTOMER_PRESETS) {
      expect(toCustomerPreset(preset)).toBe(preset);
    }
  });

  it('falls back to the default for unknown, empty or null values', () => {
    expect(toCustomerPreset(null)).toBe(DEFAULT_CUSTOMER_PRESET);
    expect(toCustomerPreset(undefined)).toBe(DEFAULT_CUSTOMER_PRESET);
    expect(toCustomerPreset('')).toBe(DEFAULT_CUSTOMER_PRESET);
    expect(toCustomerPreset('bogus')).toBe(DEFAULT_CUSTOMER_PRESET);
  });
});

describe('CUSTOMER_PRESET_OPTIONS', () => {
  it('has one option per preset id, all with Spanish labels', () => {
    expect(CUSTOMER_PRESET_OPTIONS.map((o) => o.id)).toEqual([...CUSTOMER_PRESETS]);
    for (const option of CUSTOMER_PRESET_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});
