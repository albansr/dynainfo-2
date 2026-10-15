import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupportService } from '../../../src/features/support/support.service.js';

vi.mock('../../../src/features/support/support.service.js', () => ({ SupportService: class {} }));
vi.mock('../../../src/core/logger/logger.js', () => ({ logger: { error: vi.fn(), info: vi.fn() } }));

const { startSupportAutoClose } = await import('../../../src/features/support/support.autoclose.job.js');

describe('startSupportAutoClose', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs at start and every hour until stopped, surviving failures', async () => {
    const autoCloseResolved = vi.fn().mockResolvedValueOnce(2).mockRejectedValueOnce(new Error('db down')).mockResolvedValue(0);
    const stop = startSupportAutoClose({ autoCloseResolved } as unknown as SupportService);

    expect(autoCloseResolved).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(autoCloseResolved).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(autoCloseResolved).toHaveBeenCalledTimes(3);

    stop();
    await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);
    expect(autoCloseResolved).toHaveBeenCalledTimes(3);
  });
});
