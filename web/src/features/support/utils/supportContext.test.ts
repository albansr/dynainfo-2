import { describe, it, expect } from 'vitest';
import { captureContext, contextFilters, contextUrl, dateRangeRestore, dateRangeText } from './supportContext';

const base = {
  location: { pathname: '/distribucion/detalle', search: '?brand_group=exclusivas&g=ProveedorComercial' },
  dateRange: {
    startDate: new Date('2026-01-01T05:00:00Z'),
    endDate: new Date('2026-10-14T05:00:00Z'),
    preset: 'accumulated' as const,
  },
  user: { dynaRole: 'SELLER', scope: 'MD14' },
  pageTitle: 'DynaInfo',
  userAgent: 'Mozilla/5.0',
  viewport: { width: 1440.4, height: 900 },
};

describe('captureContext', () => {
  it('captures page, filters, dates, role and screen', () => {
    expect(captureContext(base)).toEqual({
      path: '/distribucion/detalle',
      search: '?brand_group=exclusivas&g=ProveedorComercial',
      pageTitle: 'DynaInfo',
      dateRange: { start: '2026-01-01T05:00:00.000Z', end: '2026-10-14T05:00:00.000Z', preset: 'accumulated' },
      dynaRole: 'SELLER',
      scope: 'MD14',
      userAgent: 'Mozilla/5.0',
      viewport: { width: 1440, height: 900 },
    });
  });

  it('trims long fields to the API limits and tolerates a missing user', () => {
    const ctx = captureContext({ ...base, user: null, location: { pathname: '/x', search: `?q=${'a'.repeat(3000)}` }, userAgent: 'u'.repeat(900) });

    expect(ctx.search).toHaveLength(2000);
    expect(ctx.userAgent).toHaveLength(500);
    expect(ctx.dynaRole).toBeNull();
  });
});

describe('dateRangeRestore', () => {
  it('restores presets by name (recomputed) and years', () => {
    expect(dateRangeRestore({ start: 'x', end: 'y', preset: 'accumulated' })).toEqual({ kind: 'preset', preset: 'accumulated' });
    expect(dateRangeRestore({ start: 'x', end: 'y', preset: 2025 })).toEqual({ kind: 'preset', preset: 2025 });
  });

  it('restores custom ranges by their exact dates, rejecting bad ones', () => {
    expect(dateRangeRestore({ start: '2026-03-01T00:00:00.000Z', end: '2026-03-31T00:00:00.000Z', preset: 'custom' })).toEqual({
      kind: 'custom',
      start: new Date('2026-03-01T00:00:00.000Z'),
      end: new Date('2026-03-31T00:00:00.000Z'),
    });
    expect(dateRangeRestore({ start: 'nope', end: 'x', preset: null })).toBeNull();
    expect(dateRangeRestore(undefined)).toBeNull();
  });
});

describe('contextUrl / contextFilters', () => {
  it('rebuilds the URL and lists the filters', () => {
    expect(contextUrl({ path: '/estado', search: '?v=1' })).toBe('/estado?v=1');
    expect(contextUrl({})).toBe('/dashboard');
    expect(contextFilters('?brand_group=exclusivas&trail=Marcas%20Exclusivas')).toEqual([
      { key: 'brand_group', value: 'exclusivas' },
      { key: 'trail', value: 'Marcas Exclusivas' },
    ]);
    expect(contextFilters(undefined)).toEqual([]);
  });
});

describe('dateRangeText', () => {
  it('names the preset before the dates', () => {
    const range = { start: '2026-01-01T12:00:00.000Z', end: '2026-10-14T12:00:00.000Z' };
    expect(dateRangeText({ ...range, preset: 'accumulated' })).toBe('Acumulado · 01/01/2026 - 14/10/2026');
    expect(dateRangeText({ ...range, preset: 2025 })).toBe('Año 2025 · 01/01/2026 - 14/10/2026');
    expect(dateRangeText({ ...range, preset: null })).toBe('01/01/2026 - 14/10/2026');
  });
});
