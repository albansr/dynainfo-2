import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { FastifyRequest } from 'fastify';
import { supportRoutes } from '../../../src/features/support/support.routes.js';
import { setupErrorHandler } from '../../../src/core/errors/error-handler.js';
import { NotFoundError, UnauthorizedError } from '../../../src/core/errors/app-error.js';

const service = {
  createTicket: vi.fn(),
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  getScreenshot: vi.fn(),
  addMessage: vi.fn(),
  updateTicket: vi.fn(),
  openCount: vi.fn(),
};

vi.mock('../../../src/features/support/support.service.js', () => ({
  SupportService: class {
    createTicket = service.createTicket;
    listTickets = service.listTickets;
    getTicket = service.getTicket;
    getScreenshot = service.getScreenshot;
    addMessage = service.addMessage;
    updateTicket = service.updateTicket;
    openCount = service.openCount;
  },
}));

/** Session stub: the `x-test-role` header plays the signed-in user's DynaRole; absent → no session. */
vi.mock('../../../src/core/middleware/requireSession.js', () => ({
  requireSession: async (request: FastifyRequest) => {
    const role = request.headers['x-test-role'];
    if (typeof role !== 'string') throw new UnauthorizedError('No autenticado');
    request.sessionUser = { id: 'u1', email: 'ana@dyna.co', name: 'Ana', dynaRole: role, scope: null };
  },
  sessionUserOf: (request: FastifyRequest) => request.sessionUser,
}));

const WEB = 'https://dynainfo.com.co';
const SELLER = { 'x-test-role': 'SELLER', origin: WEB };
const ADMIN = { 'x-test-role': 'ADMIN', origin: WEB };
const NOW = new Date('2026-10-15T12:00:00Z');

const context = {
  path: '/dashboard',
  search: '',
  pageTitle: 'DynaInfo',
  dateRange: { start: '2026-01-01', end: '2026-10-14', preset: null },
  dynaRole: 'SELLER',
  scope: null,
  userAgent: 'test',
  viewport: { width: 1440, height: 900 },
};
const validTicket = { type: 'error', subject: 'No carga', description: 'La tabla no carga nunca', context };

describe('Support Routes', () => {
  let app: Awaited<ReturnType<typeof Fastify>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('ORIGIN_URL', WEB);
    app = Fastify({ logger: false });
    setupErrorHandler(app);
    await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
    await app.register(supportRoutes);
    await app.ready();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app.close();
  });

  describe('POST /support/tickets', () => {
    it('creates a ticket from our web origin with 201', async () => {
      service.createTicket.mockResolvedValue({ number: 12 });

      const res = await app.inject({ method: 'POST', url: '/support/tickets', headers: SELLER, payload: validTicket });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ number: 12 });
      expect(service.createTicket).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), validTicket, WEB);
    });

    it('requires a session (401) and one of our origins (403)', async () => {
      const noSession = await app.inject({ method: 'POST', url: '/support/tickets', headers: { origin: WEB }, payload: validTicket });
      const foreign = await app.inject({
        method: 'POST',
        url: '/support/tickets',
        headers: { 'x-test-role': 'SELLER', origin: 'https://evil.example' },
        payload: validTicket,
      });

      expect(noSession.statusCode).toBe(401);
      expect(foreign.statusCode).toBe(403);
      expect(service.createTicket).not.toHaveBeenCalled();
    });

    it('validates type and lengths (400)', async () => {
      for (const payload of [
        { ...validTicket, type: 'otro' },
        { ...validTicket, subject: 'ab' },
        { ...validTicket, description: 'corta' },
        { ...validTicket, context: { ...context, viewport: undefined } },
      ]) {
        const res = await app.inject({ method: 'POST', url: '/support/tickets', headers: SELLER, payload });
        expect(res.statusCode).toBe(400);
      }
    });

    it('strips unknown context fields instead of storing them', async () => {
      service.createTicket.mockResolvedValue({ number: 14 });

      await app.inject({ method: 'POST', url: '/support/tickets', headers: SELLER, payload: { ...validTicket, context: { ...context, extra: 1 } } });

      expect(service.createTicket.mock.calls[0]?.[1].context).toEqual(context);
    });

    it('accepts a screenshot-sized body on this route only', async () => {
      service.createTicket.mockResolvedValue({ number: 13 });
      const screenshot = 'A'.repeat(1_300_000);

      const res = await app.inject({ method: 'POST', url: '/support/tickets', headers: SELLER, payload: { ...validTicket, screenshot } });

      expect(res.statusCode).toBe(201);
    });
  });

  describe('GET /support/tickets', () => {
    it('lists with query validation and serializes dates', async () => {
      service.listTickets.mockResolvedValue({
        data: [{ number: 1, type: 'error', subject: 's', status: 'open', priority: 'medium', lastActivityAt: NOW, createdAt: NOW }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await app.inject({ method: 'GET', url: '/support/tickets?status=active', headers: SELLER });
      const bad = await app.inject({ method: 'GET', url: '/support/tickets?limit=500', headers: SELLER });

      expect(res.statusCode).toBe(200);
      expect(res.json().data[0].lastActivityAt).toBe('2026-10-15T12:00:00.000Z');
      expect(bad.statusCode).toBe(400);
    });
  });

  describe('GET /support/tickets/:number', () => {
    it('maps a hidden ticket to 404 and rejects a non-numeric id', async () => {
      service.getTicket.mockRejectedValue(new NotFoundError('No encontramos esta solicitud'));

      const hidden = await app.inject({ method: 'GET', url: '/support/tickets/7', headers: SELLER });
      const bad = await app.inject({ method: 'GET', url: '/support/tickets/abc', headers: SELLER });

      expect(hidden.statusCode).toBe(404);
      expect(bad.statusCode).toBe(400);
      expect(service.getTicket).toHaveBeenCalledWith(expect.anything(), 7);
    });
  });

  describe('GET /support/tickets/:number/screenshot', () => {
    it('serves the JPEG privately', async () => {
      service.getScreenshot.mockResolvedValue({ mime: 'image/jpeg', data: Buffer.from([0xff, 0xd8, 0xff]) });

      const res = await app.inject({ method: 'GET', url: '/support/tickets/12/screenshot', headers: SELLER });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.headers['cache-control']).toBe('private, max-age=3600');
      expect(res.rawPayload).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    });
  });

  describe('POST /support/tickets/:number/messages', () => {
    it('adds a message with 201 and rejects empty bodies', async () => {
      service.addMessage.mockResolvedValue({
        id: 'm1', body: 'hola', internal: false, authorIsAgent: false, authorName: 'Ana', createdAt: NOW,
      });

      const ok = await app.inject({ method: 'POST', url: '/support/tickets/12/messages', headers: SELLER, payload: { body: 'hola' } });
      const empty = await app.inject({ method: 'POST', url: '/support/tickets/12/messages', headers: SELLER, payload: { body: '' } });

      expect(ok.statusCode).toBe(201);
      expect(service.addMessage).toHaveBeenCalledWith(expect.anything(), 12, { body: 'hola' });
      expect(empty.statusCode).toBe(400);
    });
  });

  describe('agent routes', () => {
    it('PATCH and summary are for agents only (403 otherwise)', async () => {
      const patch = await app.inject({ method: 'PATCH', url: '/support/tickets/12', headers: SELLER, payload: { priority: 'high' } });
      const summary = await app.inject({ method: 'GET', url: '/support/summary', headers: SELLER });

      expect(patch.statusCode).toBe(403);
      expect(summary.statusCode).toBe(403);
      expect(service.updateTicket).not.toHaveBeenCalled();
    });

    it('lets an agent triage and read the open count', async () => {
      service.openCount.mockResolvedValue(3);
      service.updateTicket.mockResolvedValue({
        number: 12, type: 'data', subject: 's', description: 'd', status: 'in_progress', priority: 'high',
        changelogEntryId: null, lastActivityAt: NOW, resolvedAt: null, createdAt: NOW, hasScreenshot: false,
        requester: { name: 'Ana', email: 'ana@dyna.co' }, context: { path: '/' }, messages: [],
      });

      const patch = await app.inject({ method: 'PATCH', url: '/support/tickets/12', headers: ADMIN, payload: { status: 'in_progress', priority: 'high' } });
      const empty = await app.inject({ method: 'PATCH', url: '/support/tickets/12', headers: ADMIN, payload: {} });
      const summary = await app.inject({ method: 'GET', url: '/support/summary', headers: ADMIN });

      expect(patch.statusCode).toBe(200);
      expect(patch.json().context).toEqual({ path: '/' });
      expect(empty.statusCode).toBe(400);
      expect(summary.json()).toEqual({ open: 3 });
    });
  });
});
