import { describe, it, expect } from 'vitest';
import {
  getRoleDataFilter,
  canExport,
  getAllowedPresets,
  getAllowedYears,
  getRoleViewSections,
  getDefaultViewId,
  resolveActiveView,
  REGIONAL_GROUPS,
} from './access';

describe('getRoleDataFilter', () => {
  it('returns undefined for full-access roles (ADMIN/MANAGER)', () => {
    expect(getRoleDataFilter('ADMIN')).toBeUndefined();
    expect(getRoleDataFilter('MANAGER')).toBeUndefined();
    expect(getRoleDataFilter(null)).toBeUndefined();
  });

  it('scopes DISTRIBUTION by its regional group via scope', () => {
    expect(getRoleDataFilter('DISTRIBUTION', '2')).toEqual({
      channel: 'DISTRIBUCION',
      IdRegional: REGIONAL_GROUPS['2'],
    });
  });

  it('DISTRIBUTION without scope sees the whole channel (no regional filter)', () => {
    expect(getRoleDataFilter('DISTRIBUTION')).toEqual({ channel: 'DISTRIBUCION' });
  });

  it('scopes SELLER by its seller_id via scope', () => {
    expect(getRoleDataFilter('SELLER', 'V0157')).toEqual({ seller_id: 'V0157' });
  });

  it('NEW_CHANNELS has no role data filter (views carry the channel)', () => {
    expect(getRoleDataFilter('NEW_CHANNELS')).toBeUndefined();
  });
});

describe('canExport', () => {
  it('is false for SELLER, true for the rest', () => {
    expect(canExport('SELLER')).toBe(false);
    expect(canExport('ADMIN')).toBe(true);
    expect(canExport('MANAGER')).toBe(true);
    expect(canExport('BOARD')).toBe(true);
  });
});

describe('temporality gating', () => {
  it('ADMIN can pick any preset and any year', () => {
    expect(getAllowedPresets('ADMIN')).toBe('all');
    expect(getAllowedYears('ADMIN')).toBe('all');
  });

  it('BOARD only sees prior-month and accumulated', () => {
    expect(getAllowedPresets('BOARD')).toEqual(['previous-month', 'accumulated']);
  });

  it('SELLER: 4 core presets and only the previous calendar year', () => {
    expect(getAllowedPresets('SELLER')).toEqual(['previous-month', 'current-month', 'accumulated', 'today']);
    expect(getAllowedYears('SELLER')).toEqual([new Date().getFullYear() - 1]);
  });
});

describe('view sets per role', () => {
  it('ADMIN/MANAGER get the full view selector', () => {
    const sections = getRoleViewSections('ADMIN');
    const ids = sections.flatMap((s) => s.views.map((v) => v.id));
    expect(ids).toContain('general');
    expect(ids).toContain('distribucion');
    expect(ids).toContain('marcas-exclusivas');
  });

  it('NEW_CHANNELS gets exactly Todos + Exportaciones + Cadenas', () => {
    const ids = getRoleViewSections('NEW_CHANNELS').flatMap((s) => s.views.map((v) => v.id));
    expect(ids).toEqual(['todos-nuevos-canales', 'exportaciones', 'cadenas']);
  });

  it('roles without a selector get an empty view set', () => {
    for (const role of ['BOARD', 'RETAIL', 'DISTRIBUTION', 'SELLER']) {
      expect(getRoleViewSections(role)).toEqual([]);
    }
  });
});

describe('resolveActiveView', () => {
  it('ADMIN defaults to general and exposes the selector', () => {
    const { view, hasSelector } = resolveActiveView('ADMIN', null);
    expect(view.id).toBe('general');
    expect(hasSelector).toBe(true);
  });

  it('honors a requested view that the role is allowed to see', () => {
    expect(resolveActiveView('ADMIN', 'cadenas').view.id).toBe('cadenas');
  });

  it('falls back to the default when the requested view is not allowed', () => {
    // NEW_CHANNELS cannot open the retail view → default (todos)
    const { view } = resolveActiveView('NEW_CHANNELS', 'retail');
    expect(view.id).toBe('todos-nuevos-canales');
  });

  it('no-selector roles resolve to their single default view', () => {
    expect(resolveActiveView('DISTRIBUTION', null)).toMatchObject({ hasSelector: false });
    expect(resolveActiveView('DISTRIBUTION', null).view.id).toBe('distribucion');
    expect(resolveActiveView('SELLER', null).view.id).toBe('seller-default');
    expect(resolveActiveView('RETAIL', null).view.id).toBe('retail');
  });
});

describe('getDefaultViewId', () => {
  it('maps each role to its default view', () => {
    expect(getDefaultViewId('ADMIN')).toBe('general');
    expect(getDefaultViewId('NEW_CHANNELS')).toBe('todos-nuevos-canales');
    expect(getDefaultViewId('SELLER')).toBe('seller-default');
    expect(getDefaultViewId(undefined)).toBe('general');
  });
});
