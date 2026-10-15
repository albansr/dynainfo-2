import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupportService, decodeScreenshot, autoCloseDate, AUTO_CLOSE_DAYS } from '../../../src/features/support/support.service.js';
import type { SupportNotifier } from '../../../src/features/support/support.notifier.js';
import { publishedEntries } from '../../../src/features/changelog/changelog.entries.js';
import type { SessionUser } from '../../../src/core/middleware/requireSession.js';

/**
 * Chainable stand-in for the Drizzle client: every builder method records its
 * call and returns the chain; awaiting a chain resolves the next queued result.
 */
const results: unknown[] = [];
const calls: { op: string; args: unknown[] }[] = [];

function chain(kind: string) {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'offset', 'values', 'set', 'returning']) {
    c[m] = (...args: unknown[]) => {
      calls.push({ op: `${kind}.${m}`, args });
      return c;
    };
  }
  c['then'] = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(results.shift()).then(resolve, reject);
  return c;
}

vi.mock('../../../src/core/db/postgres/client.js', () => {
  const db = {
    select: (...args: unknown[]) => {
      calls.push({ op: 'select', args });
      return chain('select');
    },
    insert: () => chain('insert'),
    update: () => chain('update'),
    transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});

// The real notifier would build a Resend client; the service gets the stub below
vi.mock('../../../src/features/support/support.notifier.js', () => ({ SupportNotifier: class {} }));

const notifier = {
  newTicket: vi.fn(),
  requesterReply: vi.fn(),
  agentReply: vi.fn(),
  resolved: vi.fn(),
};

const requester: SessionUser = { id: 'u-ana', email: 'ana@dyna.co', name: 'Ana', role: 'user', dynaRole: 'SELLER', scope: 'MD14' };
const stranger: SessionUser = { id: 'u-leo', email: 'leo@dyna.co', name: 'Leo', role: 'user', dynaRole: 'MANAGER', scope: null };
const agent: SessionUser = { id: 'u-admin', email: 'admin@dyna.co', name: 'Admin', role: 'user', dynaRole: 'ADMIN', scope: null };
const superadmin: SessionUser = { id: 'u-root', email: 'root@dyna.co', name: 'Root', role: 'superadmin', dynaRole: null, scope: null };

const context = {
  path: '/distribucion/detalle',
  search: '?brand_group=exclusivas&g=ProveedorComercial',
  pageTitle: 'DynaInfo',
  dateRange: { start: '2026-01-01', end: '2026-10-14', preset: 'ytd' },
  dynaRole: 'SELLER',
  scope: 'MD14',
  realDynaRole: 'ADMIN',
  userAgent: 'test',
  viewport: { width: 1440, height: 900 },
};

const NOW = new Date('2026-10-15T12:00:00Z');

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    number: 12,
    userId: requester.id,
    type: 'data',
    subject: 'No sale el presupuesto',
    description: 'En proveedores no sale',
    status: 'open',
    priority: 'medium',
    context,
    webOrigin: 'https://dynainfo.com.co',
    changelogEntryId: null,
    awaitingTeam: true,
    satisfied: null,
    lastActivityAt: NOW,
    resolvedAt: null,
    closedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** Queue the row returned by the visibility lookup. */
const found = (overrides: Record<string, unknown> = {}) =>
  results.push([{ ticket: ticketRow(overrides), name: 'Ana', email: 'ana@dyna.co' }]);

const opArgs = (op: string) => calls.filter((c) => c.op === op).map((c) => c.args[0]);

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');

describe('SupportService', () => {
  let service: SupportService;

  beforeEach(() => {
    results.length = 0;
    calls.length = 0;
    vi.clearAllMocks();
    service = new SupportService(notifier as unknown as SupportNotifier);
  });

  describe('decodeScreenshot', () => {
    it('accepts a JPEG and rejects other formats or files over 1 MB', () => {
      expect(decodeScreenshot(JPEG).length).toBe(7);
      expect(() => decodeScreenshot(Buffer.from('PNGDATA').toString('base64'))).toThrow('JPEG');
      const big = Buffer.alloc(1_000_001, 1);
      big[0] = 0xff;
      big[1] = 0xd8;
      big[2] = 0xff;
      expect(() => decodeScreenshot(big.toString('base64'))).toThrow('1 MB');
    });
  });

  describe('createTicket', () => {
    const input = { type: 'data' as const, subject: '  No sale el presupuesto ', description: 'En proveedores no sale', context };

    it('stores the ticket with the server-side real role and notifies the team', async () => {
      results.push([ticketRow()]);

      const created = await service.createTicket(requester, input, 'https://dynainfo.com.co');

      expect(created).toEqual({ number: 12 });
      const [values] = opArgs('insert.values') as Record<string, unknown>[];
      expect(values).toMatchObject({
        userId: 'u-ana',
        subject: 'No sale el presupuesto',
        webOrigin: 'https://dynainfo.com.co',
        context: { ...context, realDynaRole: 'SELLER' },
      });
      expect(notifier.newTicket).toHaveBeenCalledWith(
        expect.objectContaining({ number: 12, path: '/distribucion/detalle', requester: expect.objectContaining({ email: 'ana@dyna.co' }) }),
      );
    });

    it('stores the screenshot apart when there is one', async () => {
      results.push([ticketRow()], undefined);

      await service.createTicket(requester, { ...input, screenshot: JPEG }, 'https://dynainfo.com.co');

      const inserts = opArgs('insert.values') as Record<string, unknown>[];
      expect(inserts[1]).toMatchObject({ ticketId: 't1', mime: 'image/jpeg', sizeBytes: 7 });
    });

    it('rejects an invalid screenshot before writing anything', async () => {
      await expect(
        service.createTicket(requester, { ...input, screenshot: Buffer.from('nope').toString('base64') }, 'x'),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(opArgs('insert.values')).toHaveLength(0);
    });
  });

  describe('listTickets', () => {
    const row = {
      number: 12,
      type: 'data',
      subject: 's',
      status: 'open',
      priority: 'medium',
      lastActivityAt: NOW,
      createdAt: NOW,
      requesterName: 'Ana',
      requesterEmail: 'ana@dyna.co',
    };

    it('lists the requester own tickets without requester details', async () => {
      results.push([row], [{ value: 1 }]);

      const list = await service.listTickets(requester, {});

      expect(list).toEqual({ data: [expect.not.objectContaining({ requester: expect.anything() })], total: 1, page: 1, limit: 20 });
      expect(list.data[0]).not.toHaveProperty('requesterEmail');
    });

    it('gives agents every ticket with its requester', async () => {
      results.push([row], [{ value: 31 }]);

      const list = await service.listTickets(agent, { scope: 'all', status: 'active', page: 2, limit: 10 });

      expect(list.total).toBe(31);
      expect(list.data[0]?.requester).toEqual({ name: 'Ana', email: 'ana@dyna.co' });
      expect(opArgs('select.offset')).toEqual([10]);
    });

    it('forbids scope=all to non-agents', async () => {
      await expect(service.listTickets(requester, { scope: 'all' })).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getTicket', () => {
    const messages = [
      { id: 'm1', body: 'hola', internal: false, authorIsAgent: true, authorName: 'Admin', createdAt: NOW },
    ];

    it('hides agent names and the full context from the requester', async () => {
      found();
      results.push(messages, [{ ticketId: 't1' }]);

      const detail = await service.getTicket(requester, 12);

      expect(detail.messages[0]?.authorName).toBeNull();
      expect(detail.context).toEqual({ path: context.path, search: context.search, dateRange: context.dateRange });
      expect(detail.hasScreenshot).toBe(true);
      expect(detail.requester).toEqual({ name: 'Ana', email: 'ana@dyna.co' });
      expect(detail).not.toHaveProperty('related');
    });

    it('gives agents the full context, names and related requests', async () => {
      found();
      // related() awaits its query first, so it takes the first queued result
      results.push(
        [
          { number: 3, subject: 'Otra', status: 'open', userId: 'u-ana', lastActivityAt: NOW },
          { number: 9, subject: 'Misma pantalla', status: 'closed', userId: 'u-leo', lastActivityAt: NOW },
        ],
        messages,
        [],
      );

      const detail = await service.getTicket(agent, 12);

      expect(detail.messages[0]?.authorName).toBe('Admin');
      expect(detail.context).toEqual(context);
      expect(detail.hasScreenshot).toBe(false);
      expect(detail.related).toEqual([
        { number: 3, subject: 'Otra', status: 'open', sameRequester: true, lastActivityAt: NOW },
        { number: 9, subject: 'Misma pantalla', status: 'closed', sameRequester: false, lastActivityAt: NOW },
      ]);
    });

    it('treats a superadmin as an agent', async () => {
      found();
      results.push([], messages, []);

      const detail = await service.getTicket(superadmin, 12);

      expect(detail.messages[0]?.authorName).toBe('Admin');
      expect(detail.related).toEqual([]);
    });

    it('answers 404 for another user ticket and for unknown numbers', async () => {
      found();
      await expect(service.getTicket(stranger, 12)).rejects.toMatchObject({ statusCode: 404 });
      results.push([]);
      await expect(service.getTicket(agent, 99)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getScreenshot', () => {
    it('returns the image or 404 when there is none', async () => {
      found();
      results.push([{ mime: 'image/jpeg', data: Buffer.from([1]) }]);
      await expect(service.getScreenshot(requester, 12)).resolves.toMatchObject({ mime: 'image/jpeg' });

      found();
      results.push([]);
      await expect(service.getScreenshot(requester, 12)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('addMessage', () => {
    const message = (overrides: Record<string, unknown> = {}) => ({
      id: 'm2',
      body: 'Sigue pasando',
      internal: false,
      authorIsAgent: false,
      createdAt: NOW,
      ...overrides,
    });

    it('a requester reply on a resolved ticket reopens it and notifies the team', async () => {
      found({ status: 'resolved', resolvedAt: NOW });
      results.push([message()], undefined);

      const created = await service.addMessage(requester, 12, { body: ' Sigue pasando ' });

      expect(created).toMatchObject({ body: 'Sigue pasando', authorName: 'Ana' });
      const [set] = opArgs('update.set') as Record<string, unknown>[];
      expect(set).toMatchObject({ status: 'open', resolvedAt: null, satisfied: null, awaitingTeam: true });
      expect(notifier.requesterReply).toHaveBeenCalledWith(expect.objectContaining({ number: 12 }), 'Sigue pasando', {
        reopened: true,
      });
      expect(notifier.agentReply).not.toHaveBeenCalled();
    });

    it('an agent public reply notifies the requester and does not reopen', async () => {
      found({ status: 'resolved', resolvedAt: NOW });
      results.push([message({ authorIsAgent: true, body: 'Revisado' })], undefined, [{ body: 'Lo último que dije' }]);

      await service.addMessage(agent, 12, { body: 'Revisado' });

      const [set] = opArgs('update.set') as Record<string, unknown>[];
      expect(set).not.toHaveProperty('status');
      expect(set).toMatchObject({ awaitingTeam: false });
      expect(notifier.agentReply).toHaveBeenCalledWith(
        expect.objectContaining({ requester: { name: 'Ana', email: 'ana@dyna.co' } }),
        'Revisado',
        'Lo último que dije',
      );
    });

    it('quotes the description when the requester has not written yet', async () => {
      found();
      results.push([message({ authorIsAgent: true, body: 'Hola' })], undefined, []);

      await service.addMessage(agent, 12, { body: 'Hola' });

      expect(notifier.agentReply).toHaveBeenCalledWith(expect.anything(), 'Hola', 'En proveedores no sale');
    });

    it('an agent can reply and resolve in one step: one email, the resolution', async () => {
      found();
      results.push([message({ authorIsAgent: true, body: 'Ya está' })], undefined);

      await service.addMessage(agent, 12, { body: 'Ya está', resolve: true });

      const [set] = opArgs('update.set') as Record<string, unknown>[];
      expect(set).toMatchObject({ status: 'resolved', awaitingTeam: false, closedAt: null });
      expect(set?.['resolvedAt']).toBeInstanceOf(Date);
      expect(notifier.resolved).toHaveBeenCalledWith(expect.objectContaining({ number: 12 }), 'Ya está', null, expect.any(Date));
      expect(notifier.agentReply).not.toHaveBeenCalled();
    });

    it('an internal note notifies nobody', async () => {
      found();
      results.push([message({ authorIsAgent: true, internal: true })], undefined);

      await service.addMessage(agent, 12, { body: 'nota', internal: true });

      expect(opArgs('insert.values')[0]).toMatchObject({ internal: true, authorIsAgent: true });
      expect(opArgs('update.set')[0]).not.toHaveProperty('awaitingTeam');
      expect(notifier.agentReply).not.toHaveBeenCalled();
      expect(notifier.requesterReply).not.toHaveBeenCalled();
    });

    it('forbids internal notes and resolving to requesters, and replies on closed tickets', async () => {
      await expect(service.addMessage(requester, 12, { body: 'x', internal: true })).rejects.toMatchObject({ statusCode: 403 });
      await expect(service.addMessage(requester, 12, { body: 'x', resolve: true })).rejects.toMatchObject({ statusCode: 403 });
      await expect(service.addMessage(agent, 12, { body: 'x', internal: true, resolve: true })).rejects.toMatchObject({ statusCode: 403 });

      found({ status: 'closed' });
      await expect(service.addMessage(requester, 12, { body: 'x' })).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('updateTicket', () => {
    const entry = publishedEntries()[0]!;

    it('resolving notifies the requester with the last public reply and the linked entry', async () => {
      found();
      results.push(undefined, [{ body: 'Ya está' }]);
      // getTicket after the update
      found({ status: 'resolved' });
      results.push([], [], []);

      const detail = await service.updateTicket(agent, 12, { status: 'resolved', changelogEntryId: entry.id });

      const [set] = opArgs('update.set') as Record<string, unknown>[];
      expect(set).toMatchObject({ status: 'resolved', changelogEntryId: entry.id, closedAt: null });
      expect(set?.['resolvedAt']).toBeInstanceOf(Date);
      expect(notifier.resolved).toHaveBeenCalledWith(
        expect.objectContaining({ number: 12 }),
        'Ya está',
        { id: entry.id, title: entry.title },
        expect.any(Date),
      );
      expect(detail.status).toBe('resolved');
    });

    it('priority or in-progress changes notify nobody and clear resolvedAt when leaving resolved', async () => {
      found({ status: 'resolved', resolvedAt: NOW });
      results.push(undefined);
      found();
      results.push([], [], []);

      await service.updateTicket(agent, 12, { status: 'in_progress', priority: 'high' });

      expect(opArgs('update.set')[0]).toMatchObject({ status: 'in_progress', priority: 'high', resolvedAt: null });
      expect(notifier.resolved).not.toHaveBeenCalled();
    });

    it('closing sets closedAt', async () => {
      found();
      results.push(undefined);
      found();
      results.push([], [], []);

      await service.updateTicket(agent, 12, { status: 'closed' });

      expect((opArgs('update.set')[0] as Record<string, unknown>)['closedAt']).toBeInstanceOf(Date);
    });

    it('rejects an unknown Novedades entry and non-agents', async () => {
      found();
      await expect(service.updateTicket(agent, 12, { changelogEntryId: 'no-existe' })).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.updateTicket(requester, 12, { priority: 'low' })).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('autoCloseResolved', () => {
    it('closes resolved tickets older than the window and reports how many', async () => {
      results.push([{ id: 't1' }, { id: 't2' }]);

      const closed = await service.autoCloseResolved(NOW);

      expect(closed).toBe(2);
      expect(opArgs('update.set')[0]).toEqual({ status: 'closed', closedAt: NOW, updatedAt: NOW });
      expect(AUTO_CLOSE_DAYS).toBe(7);
    });
  });

  describe('summary', () => {
    it('counts active requests and those waiting for the team', async () => {
      results.push([{ open: 4, awaitingTeam: 3 }]);
      await expect(service.summary()).resolves.toEqual({ open: 4, awaitingTeam: 3 });
      results.push([]);
      await expect(service.summary()).resolves.toEqual({ open: 0, awaitingTeam: 0 });
    });
  });

  describe('mySummary', () => {
    it("counts the user's active requests and those waiting for their answer", async () => {
      results.push([{ active: 3, awaitingMe: 1 }]);
      await expect(service.mySummary(requester)).resolves.toEqual({ active: 3, awaitingMe: 1 });
      results.push([]);
      await expect(service.mySummary(requester)).resolves.toEqual({ active: 0, awaitingMe: 0 });
    });
  });

  describe('giveFeedback', () => {
    it('"solved" closes the request and records the satisfaction', async () => {
      found({ status: 'resolved', resolvedAt: NOW });
      results.push(undefined);
      found({ status: 'closed' });
      results.push([], []);

      const detail = await service.giveFeedback(requester, 12, { solved: true });

      expect(opArgs('update.set')[0]).toMatchObject({ status: 'closed', satisfied: true });
      expect(notifier.requesterReply).not.toHaveBeenCalled();
      expect(detail.status).toBe('closed');
    });

    it('"not solved" reopens it for the team with the comment, and tells the team', async () => {
      found({ status: 'resolved', resolvedAt: NOW });
      results.push(undefined, undefined);
      found();
      results.push([], []);

      await service.giveFeedback(requester, 12, { solved: false, body: ' Sigue igual ' });

      expect(opArgs('insert.values')[0]).toMatchObject({ body: 'Sigue igual', authorIsAgent: false });
      expect(opArgs('update.set')[0]).toMatchObject({ status: 'open', resolvedAt: null, satisfied: false, awaitingTeam: true });
      expect(notifier.requesterReply).toHaveBeenCalledWith(expect.objectContaining({ number: 12 }), 'Sigue igual', { reopened: true });
    });

    it('only the requester, and only on resolved requests', async () => {
      found({ status: 'resolved' });
      await expect(service.giveFeedback(agent, 12, { solved: true })).rejects.toMatchObject({ statusCode: 403 });
      found({ status: 'open' });
      await expect(service.giveFeedback(requester, 12, { solved: true })).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('autoCloseDate', () => {
    it('is seven days after the resolution', () => {
      expect(autoCloseDate(NOW).toISOString()).toBe('2026-10-22T12:00:00.000Z');
    });
  });
});
