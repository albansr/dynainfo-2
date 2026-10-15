import { and, asc, count, desc, eq, gt, inArray, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../core/db/postgres/client.js';
import {
  supportMessages,
  supportScreenshots,
  supportTickets,
  users,
  type SupportTicket,
} from '../../core/db/postgres/schema.js';
import { ForbiddenError, NotFoundError, ValidationError, AppError, ErrorCode } from '../../core/errors/app-error.js';
import type { SessionUser } from '../../core/middleware/requireSession.js';
import { isSupportAgent } from '../../core/middleware/requireSupportAgent.js';
import { publishedEntries } from '../changelog/changelog.entries.js';
import {
  SCREENSHOT_MAX_BYTES,
  type CreateMessageBody,
  type CreateTicketBody,
  type FeedbackBody,
  type ListTicketsQuery,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  type UpdateTicketBody,
} from './support.schemas.js';
import { SupportNotifier, type TicketMail } from './support.notifier.js';

/** Days a resolved request stays open to a reply before it closes by itself. */
export const AUTO_CLOSE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Related requests shown to agents, and how long a closed one still counts. */
const RELATED_LIMIT = 5;
const RELATED_RECENT_DAYS = 30;

/** Context fields a requester gets back on their own ticket ("Lo que enviaste"). */
const REQUESTER_CONTEXT_KEYS = ['path', 'search', 'dateRange', 'summary'] as const;

/** Thrown when replying to a closed request, or answering feedback on one that isn't resolved (409). */
export class TicketStateError extends AppError {
  constructor(message: string) {
    super(ErrorCode.INVALID_INPUT, message, 409);
  }
}

export interface Person {
  name: string | null;
  email: string;
}

export interface TicketSummary {
  number: number;
  type: TicketType;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  awaitingTeam: boolean;
  lastActivityAt: Date;
  createdAt: Date;
  requester?: Person;
}

export interface TicketMessageView {
  id: string;
  body: string;
  internal: boolean;
  authorIsAgent: boolean;
  authorName: string | null;
  createdAt: Date;
}

export interface RelatedTicket {
  number: number;
  subject: string;
  status: TicketStatus;
  sameRequester: boolean;
  lastActivityAt: Date;
}

export interface TicketDetail {
  number: number;
  type: TicketType;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  changelogEntryId: string | null;
  awaitingTeam: boolean;
  satisfied: boolean | null;
  lastActivityAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  hasScreenshot: boolean;
  requester: Person;
  context: Record<string, unknown>;
  messages: TicketMessageView[];
  related?: RelatedTicket[];
}

/** Decode and check a base64 JPEG screenshot; throws a 400 when it is not one or too large. */
export function decodeScreenshot(base64: string): Buffer {
  const data = Buffer.from(base64, 'base64');
  const isJpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (!isJpeg) throw new ValidationError('La captura debe ser una imagen JPEG');
  if (data.length > SCREENSHOT_MAX_BYTES) throw new ValidationError('La captura supera 1 MB');
  return data;
}

/** The context a requester may see on their own ticket. */
function requesterContext(context: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(REQUESTER_CONTEXT_KEYS.filter((k) => k in context).map((k) => [k, context[k]]));
}

/** When a resolved request closes by itself. */
export function autoCloseDate(resolvedAt: Date): Date {
  return new Date(resolvedAt.getTime() + AUTO_CLOSE_DAYS * DAY_MS);
}

/**
 * Support requests: create, list, thread and triage.
 *
 * Visibility is enforced here, not in the UI: a requester only reaches their own
 * tickets (others are a 404, so numbers can't be probed), never sees internal
 * notes, and only gets back the navigational part of the context.
 *
 * `awaitingTeam` tracks whose turn it is: a new request and every requester reply
 * put it on the team; a public agent reply puts it on the requester.
 */
export class SupportService {
  constructor(private readonly notifier: SupportNotifier = new SupportNotifier()) {}

  async createTicket(user: SessionUser, input: CreateTicketBody, webOrigin: string): Promise<{ number: number }> {
    const screenshot = input.screenshot ? decodeScreenshot(input.screenshot) : null;
    const context = { ...input.context, realDynaRole: user.dynaRole };

    const ticket = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(supportTickets)
        .values({
          userId: user.id,
          type: input.type,
          subject: input.subject.trim(),
          description: input.description.trim(),
          context,
          webOrigin,
        })
        .returning();
      if (!created) throw new Error('Support ticket insert returned no row');
      if (screenshot) {
        await tx.insert(supportScreenshots).values({
          ticketId: created.id,
          mime: 'image/jpeg',
          sizeBytes: screenshot.length,
          data: screenshot,
        });
      }
      return created;
    });

    await this.notifier.newTicket(this.mail(ticket, user, Boolean(screenshot)));
    return { number: ticket.number };
  }

  async listTickets(
    user: SessionUser,
    query: ListTicketsQuery,
  ): Promise<{ data: TicketSummary[]; total: number; page: number; limit: number }> {
    const agent = isSupportAgent(user);
    const scope = query.scope ?? 'mine';
    if (scope === 'all' && !agent) throw new ForbiddenError('Solo para el equipo de soporte');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const conditions: SQL[] = [];
    if (scope === 'mine') conditions.push(eq(supportTickets.userId, user.id));
    if (query.status === 'active') conditions.push(inArray(supportTickets.status, ['open', 'in_progress']));
    else if (query.status) conditions.push(eq(supportTickets.status, query.status));
    if (query.type) conditions.push(eq(supportTickets.type, query.type));
    if (query.priority) conditions.push(eq(supportTickets.priority, query.priority));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Agents triage: requests waiting for the team first, the longest waiting on top;
    // requesters see their latest activity first
    const order =
      scope === 'all'
        ? [
            desc(supportTickets.awaitingTeam),
            sql`case when ${supportTickets.awaitingTeam} then ${supportTickets.lastActivityAt} end asc`,
            desc(supportTickets.lastActivityAt),
          ]
        : [desc(supportTickets.lastActivityAt)];

    const [rows, [totals]] = await Promise.all([
      db
        .select({
          number: supportTickets.number,
          type: supportTickets.type,
          subject: supportTickets.subject,
          status: supportTickets.status,
          priority: supportTickets.priority,
          awaitingTeam: supportTickets.awaitingTeam,
          lastActivityAt: supportTickets.lastActivityAt,
          createdAt: supportTickets.createdAt,
          requesterName: users.name,
          requesterEmail: users.email,
        })
        .from(supportTickets)
        .innerJoin(users, eq(users.id, supportTickets.userId))
        .where(where)
        .orderBy(...order)
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ value: count() }).from(supportTickets).where(where),
    ]);

    const data = rows.map(({ requesterName, requesterEmail, ...row }) => ({
      ...row,
      ...(agent ? { requester: { name: requesterName, email: requesterEmail } } : {}),
    }));
    return { data, total: totals?.value ?? 0, page, limit };
  }

  async getTicket(user: SessionUser, number: number): Promise<TicketDetail> {
    const agent = isSupportAgent(user);
    const { ticket, requester } = await this.findVisible(user, number);

    const [messages, [screenshot], related] = await Promise.all([
      db
        .select({
          id: supportMessages.id,
          body: supportMessages.body,
          internal: supportMessages.internal,
          authorIsAgent: supportMessages.authorIsAgent,
          authorName: users.name,
          createdAt: supportMessages.createdAt,
        })
        .from(supportMessages)
        .innerJoin(users, eq(users.id, supportMessages.authorId))
        .where(
          agent
            ? eq(supportMessages.ticketId, ticket.id)
            : and(eq(supportMessages.ticketId, ticket.id), eq(supportMessages.internal, false)),
        )
        .orderBy(asc(supportMessages.createdAt)),
      db
        .select({ ticketId: supportScreenshots.ticketId })
        .from(supportScreenshots)
        .where(eq(supportScreenshots.ticketId, ticket.id))
        .limit(1),
      agent ? this.related(ticket) : Promise.resolve(undefined),
    ]);

    return {
      number: ticket.number,
      type: ticket.type,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      changelogEntryId: ticket.changelogEntryId,
      awaitingTeam: ticket.awaitingTeam,
      satisfied: ticket.satisfied,
      lastActivityAt: ticket.lastActivityAt,
      resolvedAt: ticket.resolvedAt,
      createdAt: ticket.createdAt,
      hasScreenshot: Boolean(screenshot),
      requester,
      context: agent ? ticket.context : requesterContext(ticket.context),
      // Requesters see agents as the team, never by name
      messages: messages.map((m) => (agent || !m.authorIsAgent ? m : { ...m, authorName: null })),
      ...(related ? { related } : {}),
    };
  }

  async getScreenshot(user: SessionUser, number: number): Promise<{ mime: string; data: Buffer }> {
    const { ticket } = await this.findVisible(user, number);
    const [screenshot] = await db
      .select({ mime: supportScreenshots.mime, data: supportScreenshots.data })
      .from(supportScreenshots)
      .where(eq(supportScreenshots.ticketId, ticket.id))
      .limit(1);
    if (!screenshot) throw new NotFoundError('Esta solicitud no tiene captura');
    return screenshot;
  }

  async addMessage(user: SessionUser, number: number, input: CreateMessageBody): Promise<TicketMessageView> {
    const agent = isSupportAgent(user);
    const internal = input.internal ?? false;
    const resolve = input.resolve ?? false;
    if (internal && !agent) throw new ForbiddenError('Solo el equipo de soporte puede escribir notas internas');
    if (resolve && (!agent || internal)) throw new ForbiddenError('Solo el equipo de soporte puede resolver con una respuesta');

    const { ticket, requester } = await this.findVisible(user, number);
    if (ticket.status === 'closed') throw new TicketStateError('La solicitud está cerrada');

    const isOwner = ticket.userId === user.id;
    // A requester's reply to a resolved request reopens it
    const reopens = isOwner && !agent && ticket.status === 'resolved';
    const now = new Date();

    const message = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(supportMessages)
        .values({ ticketId: ticket.id, authorId: user.id, authorIsAgent: agent, internal, body: input.body.trim() })
        .returning();
      if (!created) throw new Error('Support message insert returned no row');
      await tx
        .update(supportTickets)
        .set({
          lastActivityAt: now,
          updatedAt: now,
          // Internal notes don't change whose turn it is
          ...(internal ? {} : { awaitingTeam: !agent }),
          ...(reopens ? { status: 'open' as const, resolvedAt: null, satisfied: null } : {}),
          ...(resolve ? { status: 'resolved' as const, resolvedAt: ticket.resolvedAt ?? now, closedAt: null } : {}),
        })
        .where(eq(supportTickets.id, ticket.id));
      return created;
    });

    if (!internal) {
      const mail = this.mail(ticket, requester);
      if (resolve) {
        await this.notifier.resolved(mail, message.body, this.linkedEntry(ticket.changelogEntryId), autoCloseDate(now));
      } else if (agent) {
        await this.notifier.agentReply(mail, message.body, await this.lastRequesterWords(ticket));
      } else {
        await this.notifier.requesterReply(mail, message.body, { reopened: reopens });
      }
    }

    return {
      id: message.id,
      body: message.body,
      internal: message.internal,
      authorIsAgent: message.authorIsAgent,
      authorName: user.name,
      createdAt: message.createdAt,
    };
  }

  /**
   * The requester answers "¿Se solucionó?" on a resolved request: solved closes it,
   * not solved reopens it for the team (with an optional comment).
   */
  async giveFeedback(user: SessionUser, number: number, input: FeedbackBody): Promise<TicketDetail> {
    const { ticket, requester } = await this.findVisible(user, number);
    if (ticket.userId !== user.id) throw new ForbiddenError('Solo quien envió la solicitud puede valorarla');
    if (ticket.status !== 'resolved') throw new TicketStateError('La solicitud no está resuelta');
    const now = new Date();
    const body = input.body?.trim();

    await db.transaction(async (tx) => {
      if (body && !input.solved) {
        await tx
          .insert(supportMessages)
          .values({ ticketId: ticket.id, authorId: user.id, authorIsAgent: false, internal: false, body });
      }
      await tx
        .update(supportTickets)
        .set(
          input.solved
            ? { status: 'closed', closedAt: now, satisfied: true, updatedAt: now, lastActivityAt: now }
            : {
                status: 'open',
                resolvedAt: null,
                satisfied: false,
                awaitingTeam: true,
                updatedAt: now,
                lastActivityAt: now,
              },
        )
        .where(eq(supportTickets.id, ticket.id));
    });

    if (!input.solved) {
      await this.notifier.requesterReply(this.mail(ticket, requester), body ?? null, { reopened: true });
    }
    return this.getTicket(user, number);
  }

  /** Agents only (checked by the route guard). */
  async updateTicket(user: SessionUser, number: number, patch: UpdateTicketBody): Promise<TicketDetail> {
    if (!isSupportAgent(user)) throw new ForbiddenError('Solo para el equipo de soporte');
    const { ticket, requester } = await this.findVisible(user, number);

    const entryId = patch.changelogEntryId ?? null;
    const entry = entryId ? publishedEntries().find((e) => e.id === entryId) : undefined;
    if (entryId && !entry) throw new ValidationError('La novedad indicada no existe');

    const now = new Date();
    const status = patch.status;
    const becomesResolved = status === 'resolved' && ticket.status !== 'resolved';
    await db
      .update(supportTickets)
      .set({
        ...(patch.priority ? { priority: patch.priority } : {}),
        ...(patch.changelogEntryId !== undefined ? { changelogEntryId: patch.changelogEntryId } : {}),
        ...(status
          ? {
              status,
              resolvedAt: status === 'resolved' ? (ticket.resolvedAt ?? now) : null,
              closedAt: status === 'closed' ? now : null,
              lastActivityAt: now,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(supportTickets.id, ticket.id));

    if (becomesResolved) {
      const [lastReply] = await db
        .select({ body: supportMessages.body })
        .from(supportMessages)
        .where(
          and(
            eq(supportMessages.ticketId, ticket.id),
            eq(supportMessages.authorIsAgent, true),
            eq(supportMessages.internal, false),
          ),
        )
        .orderBy(desc(supportMessages.createdAt))
        .limit(1);
      await this.notifier.resolved(
        this.mail(ticket, requester),
        lastReply?.body ?? null,
        this.linkedEntry(entryId ?? ticket.changelogEntryId),
        autoCloseDate(now),
      );
    }

    return this.getTicket(user, number);
  }

  /** Close requests resolved more than AUTO_CLOSE_DAYS ago. Idempotent; returns how many closed. */
  async autoCloseResolved(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - AUTO_CLOSE_DAYS * DAY_MS);
    const closed = await db
      .update(supportTickets)
      .set({ status: 'closed', closedAt: now, updatedAt: now })
      .where(and(eq(supportTickets.status, 'resolved'), lt(supportTickets.resolvedAt, cutoff)))
      .returning({ id: supportTickets.id });
    return closed.length;
  }

  /** Active requests, and how many of them wait for the team (the agents' badge). */
  async summary(): Promise<{ open: number; awaitingTeam: number }> {
    const [row] = await db
      .select({
        open: count(),
        awaitingTeam: sql<number>`count(*) filter (where ${supportTickets.awaitingTeam})`.mapWith(Number),
      })
      .from(supportTickets)
      .where(inArray(supportTickets.status, ['open', 'in_progress']));
    return { open: row?.open ?? 0, awaitingTeam: row?.awaitingTeam ?? 0 };
  }

  /** The user's own active requests, and how many wait for their answer (the team replied). */
  async mySummary(user: SessionUser): Promise<{ active: number; awaitingMe: number }> {
    const [row] = await db
      .select({
        active: count(),
        awaitingMe: sql<number>`count(*) filter (where not ${supportTickets.awaitingTeam})`.mapWith(Number),
      })
      .from(supportTickets)
      .where(and(eq(supportTickets.userId, user.id), inArray(supportTickets.status, ['open', 'in_progress', 'resolved'])));
    return { active: row?.active ?? 0, awaitingMe: row?.awaitingMe ?? 0 };
  }

  /** The ticket and its requester, when `user` may see it; otherwise a 404. */
  private async findVisible(user: SessionUser, number: number): Promise<{ ticket: SupportTicket; requester: Person }> {
    const [row] = await db
      .select({ ticket: supportTickets, name: users.name, email: users.email })
      .from(supportTickets)
      .innerJoin(users, eq(users.id, supportTickets.userId))
      .where(eq(supportTickets.number, number))
      .limit(1);
    if (!row || (row.ticket.userId !== user.id && !isSupportAgent(user))) {
      throw new NotFoundError('No encontramos esta solicitud');
    }
    return { ticket: row.ticket, requester: { name: row.name, email: row.email } };
  }

  /**
   * The requester's other requests and requests sent from the same screen (same
   * page and filters), for agents. Closed ones only while recent, so old noise
   * doesn't bury what matters.
   */
  private async related(ticket: SupportTicket): Promise<RelatedTicket[]> {
    const path = typeof ticket.context['path'] === 'string' ? ticket.context['path'] : null;
    const search = typeof ticket.context['search'] === 'string' ? ticket.context['search'] : '';
    const sameScreen = path
      ? sql`${supportTickets.context}->>'path' = ${path} and coalesce(${supportTickets.context}->>'search', '') = ${search}`
      : undefined;
    const recentCutoff = new Date(Date.now() - RELATED_RECENT_DAYS * DAY_MS);
    const rows = await db
      .select({
        number: supportTickets.number,
        subject: supportTickets.subject,
        status: supportTickets.status,
        userId: supportTickets.userId,
        lastActivityAt: supportTickets.lastActivityAt,
      })
      .from(supportTickets)
      .where(
        and(
          ne(supportTickets.id, ticket.id),
          or(eq(supportTickets.userId, ticket.userId), sameScreen),
          or(ne(supportTickets.status, 'closed'), gt(supportTickets.lastActivityAt, recentCutoff)),
        ),
      )
      .orderBy(desc(supportTickets.lastActivityAt))
      .limit(RELATED_LIMIT);
    return rows.map(({ userId, ...row }) => ({ ...row, sameRequester: userId === ticket.userId }));
  }

  /** What the requester last said (their latest public message, or the description). */
  private async lastRequesterWords(ticket: SupportTicket): Promise<string> {
    const [last] = await db
      .select({ body: supportMessages.body })
      .from(supportMessages)
      .where(
        and(
          eq(supportMessages.ticketId, ticket.id),
          eq(supportMessages.authorIsAgent, false),
          eq(supportMessages.internal, false),
        ),
      )
      .orderBy(desc(supportMessages.createdAt))
      .limit(1);
    return last?.body ?? ticket.description;
  }

  private linkedEntry(entryId: string | null): { id: string; title: string } | null {
    const entry = entryId ? publishedEntries().find((e) => e.id === entryId) : undefined;
    return entry ? { id: entry.id, title: entry.title } : null;
  }

  private mail(ticket: SupportTicket, requester: Person, hasScreenshot = false): TicketMail {
    const summary = ticket.context['summary'] as TicketMail['summary'] | undefined;
    return {
      number: ticket.number,
      type: ticket.type,
      subject: ticket.subject,
      description: ticket.description,
      path: typeof ticket.context['path'] === 'string' ? ticket.context['path'] : '',
      summary: summary ?? null,
      hasScreenshot,
      webOrigin: ticket.webOrigin,
      requester,
    };
  }
}
