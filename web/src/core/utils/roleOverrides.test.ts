import { describe, it, expect } from 'vitest';
import { applyRoleOverrides } from './roleOverrides';

const admin = { id: 'u1', dynaRole: 'ADMIN', scope: null };
const seller = { id: 'u2', dynaRole: 'SELLER', scope: 'MD14' };
const viewAs = { dynaRole: 'DISTRIBUTION', scope: '2' };
const demo = { dynaRole: 'BOARD', scope: null };

describe('applyRoleOverrides', () => {
  it('applies "view as" over everything for a support agent', () => {
    expect(applyRoleOverrides(admin, { viewAs, canViewAs: true, demo, demoEnabled: true })).toEqual({ id: 'u1', ...viewAs });
  });

  it('ignores "view as" for non-agents', () => {
    expect(applyRoleOverrides(seller, { viewAs, canViewAs: false, demo: null, demoEnabled: false })).toEqual(seller);
  });

  it('falls back to the demo role only where the demo is enabled', () => {
    expect(applyRoleOverrides(seller, { viewAs: null, canViewAs: false, demo, demoEnabled: true })).toEqual({ id: 'u2', ...demo });
    expect(applyRoleOverrides(seller, { viewAs: null, canViewAs: false, demo, demoEnabled: false })).toEqual(seller);
  });

  it('keeps the real user without overrides', () => {
    expect(applyRoleOverrides(admin, { viewAs: null, canViewAs: true, demo: null, demoEnabled: true })).toBe(admin);
  });
});
