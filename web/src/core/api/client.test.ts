import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, APIError } from './client';
import { useAuthStore, type User } from '@/core/store/authStore';

const user: User = {
  id: 'u1', email: 'x@dyna.com', emailVerified: true, name: 'T', image: null,
  dynaRole: 'ADMIN', scope: null, createdAt: new Date(), updatedAt: new Date(),
};

function mockFetch(status: number, body: unknown = {}) {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
  globalThis.fetch = vi.fn().mockResolvedValue(res);
}

describe('apiClient', () => {
  beforeEach(() => useAuthStore.setState({ user, isAuthenticated: true }));
  afterEach(() => vi.restoreAllMocks());

  it('returns parsed JSON on success', async () => {
    mockFetch(200, { hello: 'world' });
    await expect(apiClient('/api/x')).resolves.toEqual({ hello: 'world' });
  });

  it('throws APIError and logs the user out on 401', async () => {
    mockFetch(401, { detail: 'no session' });
    await expect(apiClient('/api/x')).rejects.toBeInstanceOf(APIError);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('throws on other errors WITHOUT logging out', async () => {
    mockFetch(500, { detail: 'boom' });
    await expect(apiClient('/api/x')).rejects.toMatchObject({ status: 500 });
    expect(useAuthStore.getState().user).not.toBeNull();
  });
});
