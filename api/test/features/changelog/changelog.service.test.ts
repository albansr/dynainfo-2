import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangelogService, normalizeEmail } from '../../../src/features/changelog/changelog.service.js';

const mockLimit = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();
const mockRecipients = vi.fn();

// Minimal chainable Drizzle stand-in: each terminal call is a mock we control
vi.mock('../../../src/core/db/postgres/client.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          const rows = mockRecipients(condition);
          return Object.assign(Promise.resolve(rows), { limit: () => mockLimit() });
        },
      }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        mockValues(values);
        return {
          onConflictDoNothing: () =>
            Object.assign(Promise.resolve(), { returning: () => mockReturning() }),
        };
      },
    }),
    update: () => ({
      set: (values: unknown) => {
        mockSet(values);
        return { where: () => Promise.resolve() };
      },
    }),
  },
}));

vi.mock('../../../src/core/db/postgres/schema.js', () => ({
  changelogSubscribers: { id: 'id', email: 'email', token: 'token', status: 'status' },
  changelogDigestRuns: { digestDate: 'digest_date' },
}));

const DEV = 'https://dev.dynainfo.com.co';
const PROD = 'https://dynainfo.com.co';

describe('ChangelogService', () => {
  let service: ChangelogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChangelogService();
  });

  it('normalizes emails (trim + lowercase)', () => {
    expect(normalizeEmail('  Ana@Ejemplo.COM ')).toBe('ana@ejemplo.com');
  });

  describe('subscribe', () => {
    it('inserts an unknown email as active with a long random token', async () => {
      mockLimit.mockResolvedValue([]);

      await service.subscribe(' Ana@Ejemplo.com ', DEV);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@ejemplo.com', webOrigin: DEV, status: 'active' }),
      );
      const { token } = mockValues.mock.calls[0]![0] as { token: string };
      expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('re-activates a previously unsubscribed email without changing its token', async () => {
      mockLimit.mockResolvedValue([{ id: 's1', status: 'unsubscribed', webOrigin: DEV }]);

      await service.subscribe('ana@ejemplo.com', DEV);

      expect(mockValues).not.toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active', unsubscribedAt: null }),
      );
      expect(mockSet.mock.calls[0]![0]).not.toHaveProperty('token');
    });

    it('is a no-op for an already active email from the same site', async () => {
      mockLimit.mockResolvedValue([{ id: 's1', status: 'active', webOrigin: DEV }]);

      await service.subscribe('ana@ejemplo.com', DEV);

      expect(mockValues).not.toHaveBeenCalled();
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('follows the site an active subscriber subscribes from last', async () => {
      mockLimit.mockResolvedValue([{ id: 's1', status: 'active', webOrigin: DEV }]);

      await service.subscribe('ana@ejemplo.com', PROD);

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ webOrigin: PROD, status: 'active' }));
    });
  });

  describe('unsubscribe', () => {
    it('returns null for an unknown token', async () => {
      mockLimit.mockResolvedValue([]);

      await expect(service.unsubscribe('nope')).resolves.toBeNull();
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('marks an active subscriber as unsubscribed and returns their site', async () => {
      mockLimit.mockResolvedValue([{ id: 's1', status: 'active', webOrigin: DEV }]);

      await expect(service.unsubscribe('tok')).resolves.toEqual({ webOrigin: DEV });
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'unsubscribed', unsubscribedAt: expect.any(Date) }),
      );
    });

    it('is idempotent for an already unsubscribed subscriber', async () => {
      mockLimit.mockResolvedValue([{ id: 's1', status: 'unsubscribed', webOrigin: PROD }]);

      await expect(service.unsubscribe('tok')).resolves.toEqual({ webOrigin: PROD });
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  it('lists active recipients as email + token', async () => {
    mockRecipients.mockReturnValue([{ email: 'a@b.co', token: 't1' }]);

    await expect(service.listActiveRecipients()).resolves.toEqual([{ email: 'a@b.co', token: 't1' }]);
  });

  describe('claimDigestDay', () => {
    it('claims an unsent day', async () => {
      mockReturning.mockResolvedValue([{ digestDate: '2026-10-06' }]);

      await expect(service.claimDigestDay('2026-10-06')).resolves.toBe(true);
      expect(mockValues).toHaveBeenCalledWith({ digestDate: '2026-10-06' });
    });

    it('refuses a day that was already claimed', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.claimDigestDay('2026-10-06')).resolves.toBe(false);
    });
  });

  it('records the recipient count of a sent day', async () => {
    await service.recordDigestRecipients('2026-10-06', 12);

    expect(mockSet).toHaveBeenCalledWith({ recipients: 12 });
  });
});
