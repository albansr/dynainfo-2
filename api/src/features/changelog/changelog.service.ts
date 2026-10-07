import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/postgres/client.js';
import { changelogDigestRuns, changelogSubscribers } from '../../core/db/postgres/schema.js';

export interface DigestRecipient {
  email: string;
  token: string;
  /** Site the subscriber signed up from; null for rows without one. */
  webOrigin: string | null;
}

/** Unguessable per-subscriber token (one-click unsubscribe link). */
function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Normalize an email for storage/lookup so casing can't duplicate a person. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Public Novedades subscription list (single opt-in: active immediately) and the
 * digest run ledger.
 *
 * `subscribe` is idempotent and enumeration-safe: it produces the same outcome
 * whether the address was new, already active or previously unsubscribed.
 * Unsubscribe is driven purely by the secret token.
 */
export class ChangelogService {
  /**
   * Subscribe `email` from `webOrigin` (active immediately):
   * - unknown → insert as `active`,
   * - previously `unsubscribed` → re-activate, keeping its stable token,
   * - already `active` → only follow the site they subscribed from last.
   */
  async subscribe(rawEmail: string, webOrigin: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const [existing] = await db
      .select()
      .from(changelogSubscribers)
      .where(eq(changelogSubscribers.email, email))
      .limit(1);

    if (!existing) {
      await db
        .insert(changelogSubscribers)
        .values({ email, token: generateToken(), webOrigin, status: 'active' })
        .onConflictDoNothing();
      return;
    }
    if (existing.status !== 'active' || existing.webOrigin !== webOrigin) {
      await db
        .update(changelogSubscribers)
        .set({ status: 'active', webOrigin, unsubscribedAt: null, updatedAt: new Date() })
        .where(eq(changelogSubscribers.id, existing.id));
    }
  }

  /**
   * Unsubscribe by token. Idempotent. Returns the subscriber's web origin (to send
   * them back to the same site), or null when the token matched nobody.
   */
  async unsubscribe(token: string): Promise<{ webOrigin: string | null } | null> {
    const [subscriber] = await db
      .select()
      .from(changelogSubscribers)
      .where(eq(changelogSubscribers.token, token))
      .limit(1);
    if (!subscriber) return null;
    if (subscriber.status !== 'unsubscribed') {
      const now = new Date();
      await db
        .update(changelogSubscribers)
        .set({ status: 'unsubscribed', unsubscribedAt: now, updatedAt: now })
        .where(eq(changelogSubscribers.id, subscriber.id));
    }
    return { webOrigin: subscriber.webOrigin };
  }

  /** Active subscribers (email, token, origin site) for the daily digest. */
  async listActiveRecipients(): Promise<DigestRecipient[]> {
    return db
      .select({
        email: changelogSubscribers.email,
        token: changelogSubscribers.token,
        webOrigin: changelogSubscribers.webOrigin,
      })
      .from(changelogSubscribers)
      .where(eq(changelogSubscribers.status, 'active'));
  }

  /**
   * Claim a digest day before sending. Returns false when the day was already
   * claimed (sent by an earlier tick, a previous process or another instance).
   */
  async claimDigestDay(digestDate: string): Promise<boolean> {
    const claimed = await db
      .insert(changelogDigestRuns)
      .values({ digestDate })
      .onConflictDoNothing()
      .returning({ digestDate: changelogDigestRuns.digestDate });
    return claimed.length > 0;
  }

  /** Record how many subscribers a claimed digest day reached. */
  async recordDigestRecipients(digestDate: string, recipients: number): Promise<void> {
    await db
      .update(changelogDigestRuns)
      .set({ recipients })
      .where(eq(changelogDigestRuns.digestDate, digestDate));
  }
}
