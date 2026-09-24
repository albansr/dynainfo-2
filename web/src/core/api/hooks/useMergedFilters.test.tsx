import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthStore, type User } from '@/core/store/authStore';
import { useMergedFilters } from './useMergedFilters';

function setRole(dynaRole: string | null, scope: string | null = null) {
  const user: User = {
    id: 'u1',
    email: 'x@dyna.com',
    emailVerified: true,
    name: 'Test',
    image: null,
    dynaRole,
    scope,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  useAuthStore.setState({ user });
}

describe('useMergedFilters', () => {
  beforeEach(() => useAuthStore.setState({ user: null }));

  it('returns the caller filters unchanged for a full-access role', () => {
    setRole('ADMIN');
    const { result } = renderHook(() => useMergedFilters({ a: '1' }));
    expect(result.current).toEqual({ a: '1' });
  });

  it('merges the role scope (DISTRIBUTION regional group) over the caller filters', () => {
    setRole('DISTRIBUTION', '1');
    const { result } = renderHook(() => useMergedFilters({ Marca: 'X' }));
    expect(result.current).toEqual({ Marca: 'X', channel: 'DISTRIBUCION', IdRegional: ['0001', '0026'] });
  });

  it('the role filter wins over a colliding caller key (scoping cannot be widened)', () => {
    setRole('DISTRIBUTION', '1');
    const { result } = renderHook(() => useMergedFilters({ channel: 'CADENAS' }));
    expect(result.current?.channel).toBe('DISTRIBUCION');
  });

  it('SELLER injects its seller_id', () => {
    setRole('SELLER', 'V9');
    const { result } = renderHook(() => useMergedFilters(undefined));
    expect(result.current).toEqual({ seller_id: 'V9' });
  });
});
