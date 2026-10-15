/**
 * Auto-close job, scheduled inside the API process: once at startup and every
 * hour, close requests resolved more than AUTO_CLOSE_DAYS ago. The update is
 * idempotent, so restarts or a second instance are harmless.
 */
import { logger } from '../../core/logger/logger.js';
import { SupportService } from './support.service.js';

const TICK_MS = 60 * 60 * 1000;

/** Start the scheduler. Returns a stop function for graceful shutdown. */
export function startSupportAutoClose(service: SupportService = new SupportService()): () => void {
  const tick = async () => {
    try {
      const closed = await service.autoCloseResolved(new Date());
      if (closed > 0) logger.info({ type: 'support_autoclose', closed }, 'Resolved support requests closed');
    } catch (error) {
      logger.error({ type: 'support_autoclose_error', err: error }, 'Support auto-close tick failed');
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref();
  return () => clearInterval(timer);
}
