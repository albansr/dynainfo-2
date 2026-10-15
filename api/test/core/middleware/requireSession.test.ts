import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { requireSession, sessionUserOf } from '../../../src/core/middleware/requireSession.js';
import { requireSupportAgent, isSupportAgent } from '../../../src/core/middleware/requireSupportAgent.js';

const mockGetSession = vi.fn();

vi.mock('../../../src/core/auth/auth.js', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

const request = (): FastifyRequest => ({ headers: { cookie: 'better-auth.session_token=abc' } }) as unknown as FastifyRequest;

describe('requireSession', () => {
  beforeEach(() => mockGetSession.mockReset());

  it('rejects a request without a session with 401', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(requireSession(request())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('reads the session from the cookies and attaches the user with its DynaRole', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', email: 'ana@dyna.co', name: 'Ana', dynaRole: 'SELLER', scope: 'MD14' },
    });
    const req = request();

    await requireSession(req);

    const headers = mockGetSession.mock.calls[0]?.[0]?.headers as Headers;
    expect(headers.get('cookie')).toBe('better-auth.session_token=abc');
    expect(req.sessionUser).toEqual({ id: 'u1', email: 'ana@dyna.co', name: 'Ana', dynaRole: 'SELLER', scope: 'MD14' });
    expect(sessionUserOf(req).id).toBe('u1');
  });

  it('defaults missing profile fields to null', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', email: 'ana@dyna.co' } });
    const req = request();

    await requireSession(req);

    expect(req.sessionUser).toMatchObject({ name: null, dynaRole: null, scope: null });
  });

  it('sessionUserOf throws 401 when the guard did not run', () => {
    expect(() => sessionUserOf(request())).toThrow(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('requireSupportAgent', () => {
  const withRole = (dynaRole: string | null) =>
    ({ sessionUser: { id: 'u1', email: 'a@b.co', name: null, dynaRole, scope: null } }) as unknown as FastifyRequest;

  it('lets a real ADMIN through', async () => {
    await expect(requireSupportAgent(withRole('ADMIN'))).resolves.toBeUndefined();
    expect(isSupportAgent({ dynaRole: 'ADMIN' })).toBe(true);
  });

  it('rejects any other role, and a request without session user, with 403', async () => {
    await expect(requireSupportAgent(withRole('MANAGER'))).rejects.toMatchObject({ statusCode: 403 });
    await expect(requireSupportAgent(withRole(null))).rejects.toMatchObject({ statusCode: 403 });
    await expect(requireSupportAgent({} as FastifyRequest)).rejects.toMatchObject({ statusCode: 403 });
  });
});
