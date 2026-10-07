import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { changelogRoutes } from '../../../src/features/changelog/changelog.routes.js';
import { setupErrorHandler } from '../../../src/core/errors/error-handler.js';
import { CHANGELOG_ENTRIES } from '../../../src/features/changelog/changelog.entries.js';

const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('../../../src/features/changelog/changelog.service.js', () => ({
  ChangelogService: class {
    subscribe = mockSubscribe;
    unsubscribe = mockUnsubscribe;
  },
}));

const WEB = 'https://dynainfo.com.co';

describe('Changelog Routes', () => {
  let app: Awaited<ReturnType<typeof Fastify>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('ORIGIN_URL', `${WEB},https://dev.dynainfo.com.co`);
    vi.stubEnv('NODE_ENV', 'production');
    app = Fastify({ logger: false });
    setupErrorHandler(app);
    await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
    await app.register(changelogRoutes);
    await app.ready();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app.close();
  });

  const subscribe = (body: object, headers: Record<string, string> = { origin: WEB }) =>
    app.inject({ method: 'POST', url: '/changelog/subscribe', payload: body, headers });

  describe('GET /changelog/entries', () => {
    it('returns only published entries without the published flag', async () => {
      const response = await app.inject({ method: 'GET', url: '/changelog/entries' });

      expect(response.statusCode).toBe(200);
      const { entries } = response.json();
      const publishedIds = CHANGELOG_ENTRIES.filter((e) => e.published).map((e) => e.id);
      expect(entries.map((e: { id: string }) => e.id)).toEqual(publishedIds);
      expect(entries[0]).not.toHaveProperty('published');
    });
  });

  describe('POST /changelog/subscribe', () => {
    it('subscribes from an allowed origin with a generic 200', async () => {
      const response = await subscribe({ email: 'Ana@Ejemplo.com' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
      expect(mockSubscribe).toHaveBeenCalledWith('Ana@Ejemplo.com', WEB);
    });

    it('accepts any configured origin and a matching Referer when Origin is absent', async () => {
      await subscribe({ email: 'a@b.co' }, { origin: 'https://dev.dynainfo.com.co/' });
      await subscribe({ email: 'c@d.co' }, { referer: `${WEB}/novedades` });

      expect(mockSubscribe).toHaveBeenNthCalledWith(1, 'a@b.co', 'https://dev.dynainfo.com.co');
      expect(mockSubscribe).toHaveBeenNthCalledWith(2, 'c@d.co', WEB);
    });

    it('rejects a foreign or missing origin with 403 and does not subscribe', async () => {
      const foreign = await subscribe({ email: 'a@b.co' }, { origin: 'https://evil.example' });
      const missing = await subscribe({ email: 'a@b.co' }, {});
      const badReferer = await subscribe({ email: 'a@b.co' }, { referer: 'not a url' });

      expect([foreign.statusCode, missing.statusCode, badReferer.statusCode]).toEqual([403, 403, 403]);
      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('silently ignores a filled honeypot', async () => {
      const response = await subscribe({ email: 'bot@spam.co', website: 'http://spam' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('rejects an invalid email with 400', async () => {
      const response = await subscribe({ email: 'no-es-email' });

      expect(response.statusCode).toBe(400);
      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('rate-limits bursts to 5 per minute', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 6; i++) codes.push((await subscribe({ email: `u${i}@b.co` })).statusCode);

      expect(codes).toEqual([200, 200, 200, 200, 200, 429]);
    });
  });

  describe('GET /changelog/unsubscribe', () => {
    const unsubscribeVia = async (stored: { webOrigin: string | null } | null) => {
      mockUnsubscribe.mockResolvedValue(stored);
      return app.inject({ method: 'GET', url: '/changelog/unsubscribe?token=tok123' });
    };

    it('unsubscribes and redirects back to the site the subscriber came from', async () => {
      const response = await unsubscribeVia({ webOrigin: 'https://dev.dynainfo.com.co' });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('https://dev.dynainfo.com.co/novedades/baja');
      expect(mockUnsubscribe).toHaveBeenCalledWith('tok123');
    });

    it('falls back to the primary origin for unknown tokens or origins no longer allowed', async () => {
      const unknown = await unsubscribeVia(null);
      const stale = await unsubscribeVia({ webOrigin: 'https://old.example' });

      expect(unknown.headers.location).toBe(`${WEB}/novedades/baja`);
      expect(stale.headers.location).toBe(`${WEB}/novedades/baja`);
    });

    it('requires a token', async () => {
      const response = await app.inject({ method: 'GET', url: '/changelog/unsubscribe' });

      expect(response.statusCode).toBe(400);
      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });
  });

  describe('POST /changelog/unsubscribe (one-click)', () => {
    it('accepts the RFC 8058 form body and unsubscribes by query token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/changelog/unsubscribe?token=tok123',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'List-Unsubscribe=One-Click',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
      expect(mockUnsubscribe).toHaveBeenCalledWith('tok123');
    });
  });
});
