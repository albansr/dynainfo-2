import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChangelogService } from '../../../src/features/changelog/changelog.service.js';
import type { ChangelogEntry } from '../../../src/features/changelog/changelog.entries.js';

const mockSend = vi.fn();

vi.mock('../../../src/core/email/resend.client.js', () => ({
  resend: { emails: { send: (args: unknown) => mockSend(args) } },
  EMAIL_FROM: 'DynaInfo <no-reply@test>',
}));

// The job is always driven with an injected fake service; the real one would open Postgres
vi.mock('../../../src/features/changelog/changelog.service.js', () => ({
  ChangelogService: class {},
}));

vi.mock('../../../src/core/logger/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

// Two published entries on 2026-10-06 and one unpublished, to drive the job
vi.mock('../../../src/features/changelog/changelog.entries.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/features/changelog/changelog.entries.js')>();
  const base: ChangelogEntry = {
    id: 'x',
    date: '2026-10-06',
    title: 'Entrada',
    published: true,
    changes: [{ category: 'nuevo', items: ['**Algo** nuevo'] }],
  };
  const entries: ChangelogEntry[] = [
    { ...base, id: 'a', title: 'Primera' },
    { ...base, id: 'b', title: 'Segunda' },
    { ...base, id: 'c', date: '2026-10-05', published: false },
  ];
  return {
    ...original,
    CHANGELOG_ENTRIES: entries,
    publishedEntries: () => entries.filter((e) => e.published),
  };
});

const { sendDigestForDate, runDigestTick } = await import(
  '../../../src/features/changelog/changelog.digest.job.js'
);

function fakeService(overrides: Partial<Record<keyof ChangelogService, unknown>> = {}) {
  return {
    claimDigestDay: vi.fn().mockResolvedValue(true),
    listActiveRecipients: vi.fn().mockResolvedValue([
      { email: 'ana@b.co', token: 'tok/ana', webOrigin: 'https://dynainfo.com.co' },
      { email: 'luis@b.co', token: 'tok-luis', webOrigin: 'https://dev.dynainfo.com.co' },
    ]),
    recordDigestRecipients: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ChangelogService & Record<string, ReturnType<typeof vi.fn>>;
}

describe('changelog digest job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('BETTER_AUTH_URL', 'https://api.dynainfo.com.co/');
    vi.stubEnv('ORIGIN_URL', 'https://dynainfo.com.co,https://dev.dynainfo.com.co');
    vi.stubEnv('NODE_ENV', 'production');
    mockSend.mockResolvedValue({ data: { id: 'm1' }, error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  describe('sendDigestForDate', () => {
    it('sends nothing and claims nothing on a day without published entries', async () => {
      const service = fakeService();

      await expect(sendDigestForDate('2026-10-05', service)).resolves.toEqual({ status: 'empty' });
      expect(service.claimDigestDay).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('skips a day that was already sent', async () => {
      const service = fakeService({ claimDigestDay: vi.fn().mockResolvedValue(false) });

      await expect(sendDigestForDate('2026-10-06', service)).resolves.toEqual({ status: 'already-sent' });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('sends one multipart email per subscriber with its own one-click unsubscribe', async () => {
      const service = fakeService();

      const result = await sendDigestForDate('2026-10-06', service);

      expect(result).toEqual({ status: 'sent', sent: 2, failed: 0 });
      expect(mockSend).toHaveBeenCalledTimes(2);
      const first = mockSend.mock.calls[0]![0];
      const unsubscribe = 'https://api.dynainfo.com.co/api/changelog/unsubscribe?token=tok%2Fana';
      expect(first).toMatchObject({
        from: 'DynaInfo <no-reply@test>',
        to: 'ana@b.co',
        subject: 'Novedades DynaInfo · 2 novedades',
        headers: {
          'List-Unsubscribe': `<${unsubscribe}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      expect(first.html).toContain('https://dynainfo.com.co/novedades');
      expect(first.text).toContain(unsubscribe);
      expect(service.recordDigestRecipients).toHaveBeenCalledWith('2026-10-06', 2);
    });

    it('points links at the subscriber site and tags non-production emails', async () => {
      await sendDigestForDate('2026-10-06', fakeService());

      const [prod, dev] = mockSend.mock.calls.map((call) => call[0]);
      expect(prod.subject).toBe('Novedades DynaInfo · 2 novedades');
      expect(dev.subject).toBe('[DEV] Novedades DynaInfo · 2 novedades');
      expect(dev.html).toContain('href="https://dev.dynainfo.com.co/novedades"');
      expect(dev.html).toContain('Entorno DEV');
      expect(dev.html).not.toContain('href="https://dynainfo.com.co/novedades"');
    });

    it('keeps going when one recipient fails and records only the delivered ones', async () => {
      mockSend
        .mockResolvedValueOnce({ data: null, error: { message: 'invalid address' } })
        .mockResolvedValueOnce({ data: { id: 'm2' }, error: null });
      const service = fakeService();

      await expect(sendDigestForDate('2026-10-06', service)).resolves.toEqual({
        status: 'sent',
        sent: 1,
        failed: 1,
      });
      expect(service.recordDigestRecipients).toHaveBeenCalledWith('2026-10-06', 1);
    });
  });

  describe('runDigestTick', () => {
    it('does nothing before 08:00 Bogota', async () => {
      const service = fakeService();

      // 12:59 UTC = 07:59 in Bogota
      await expect(runDigestTick(new Date('2026-10-07T12:59:00Z'), service)).resolves.toBeNull();
      expect(service.claimDigestDay).not.toHaveBeenCalled();
    });

    it("from 08:00 Bogota sends the previous day's digest", async () => {
      const service = fakeService();

      // 13:00 UTC = 08:00 on 2026-10-07 in Bogota → digest for 2026-10-06
      const result = await runDigestTick(new Date('2026-10-07T13:00:00Z'), service);

      expect(result).toEqual({ status: 'sent', sent: 2, failed: 0 });
      expect(service.claimDigestDay).toHaveBeenCalledWith('2026-10-06');
    });
  });
});
