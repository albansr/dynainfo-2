/**
 * Daily Novedades digest job, scheduled inside the API process.
 *
 * Every tick (and once at startup) it checks whether it is past DIGEST_HOUR in
 * the project timezone and, if so, sends the previous day's published entries to
 * every active subscriber — one email each, with its own one-click unsubscribe
 * link. A day is claimed in Postgres before sending, so restarts never send it
 * twice. Days without entries send nothing.
 */
import { resend, EMAIL_FROM } from '../../core/email/resend.client.js';
import { environmentTag, resolveWebOrigin } from '../../core/config/web-origin.js';
import { logger } from '../../core/logger/logger.js';
import { ChangelogService, type DigestRecipient } from './changelog.service.js';
import type { ChangelogEntry } from './changelog.entries.js';
import {
  entriesForDate,
  previousDay,
  renderDigestHtml,
  renderDigestSubject,
  renderDigestText,
  zonedDateHour,
} from './changelog.digest.js';

export const DIGEST_TIME_ZONE = 'America/Bogota';
export const DIGEST_HOUR = 8;
const TICK_MS = 15 * 60 * 1000;

export type DigestResult =
  | { status: 'empty' }
  | { status: 'already-sent' }
  | { status: 'sent'; sent: number; failed: number };

/** Public API base for the unsubscribe link (the API's own URL, BETTER_AUTH_URL). */
function unsubscribeUrl(token: string): string {
  const apiBase = (process.env['BETTER_AUTH_URL'] ?? '').replace(/\/$/, '');
  return `${apiBase}/api/changelog/unsubscribe?token=${encodeURIComponent(token)}`;
}

async function sendToRecipient(
  recipient: DigestRecipient,
  date: string,
  entries: readonly ChangelogEntry[],
): Promise<boolean> {
  // Links, images and the environment label follow the site they subscribed from
  const webOrigin = resolveWebOrigin(recipient.webOrigin);
  const links = {
    webOrigin,
    unsubscribeUrl: unsubscribeUrl(recipient.token),
    environmentTag: environmentTag(webOrigin),
  };
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: recipient.email,
    subject: renderDigestSubject(entries, links.environmentTag),
    html: renderDigestHtml(entries, links),
    text: renderDigestText(entries, links),
    headers: {
      // RFC 2369 + RFC 8058 one-click unsubscribe (Gmail/Yahoo bulk sender rules)
      'List-Unsubscribe': `<${links.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
  if (error) {
    // One bad address must not abort the run
    logger.error({ type: 'changelog_digest_send_error', err: error, date }, 'Failed to send Novedades digest');
    return false;
  }
  return true;
}

/** Send the digest for one day (YYYY-MM-DD). Safe to call repeatedly. */
export async function sendDigestForDate(
  date: string,
  service: ChangelogService = new ChangelogService(),
): Promise<DigestResult> {
  const entries = entriesForDate(date);
  if (entries.length === 0) return { status: 'empty' };
  if (!(await service.claimDigestDay(date))) return { status: 'already-sent' };

  const recipients = await service.listActiveRecipients();
  let sent = 0;
  for (const recipient of recipients) {
    if (await sendToRecipient(recipient, date, entries)) sent++;
  }
  await service.recordDigestRecipients(date, sent);
  return { status: 'sent', sent, failed: recipients.length - sent };
}

/** One scheduler tick: from DIGEST_HOUR on, send yesterday's digest (project timezone). */
export async function runDigestTick(
  now: Date,
  service: ChangelogService = new ChangelogService(),
): Promise<DigestResult | null> {
  const { date, hour } = zonedDateHour(now, DIGEST_TIME_ZONE);
  if (hour < DIGEST_HOUR) return null;
  return sendDigestForDate(previousDay(date), service);
}

/** Start the in-process scheduler. Returns a stop function for graceful shutdown. */
export function startDigestScheduler(): () => void {
  const tick = async () => {
    try {
      const result = await runDigestTick(new Date());
      if (result?.status === 'sent') {
        logger.info({ type: 'changelog_digest_sent', ...result }, 'Novedades digest sent');
      }
    } catch (error) {
      logger.error({ type: 'changelog_digest_error', err: error }, 'Novedades digest tick failed');
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref();
  return () => clearInterval(timer);
}
