import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  serial,
  jsonb,
  index,
  customType,
} from 'drizzle-orm/pg-core';

/**
 * Users table - Core authentication and user management
 *
 * Role hierarchy: superadmin > admin > user
 * - superadmin: Full system access, can manage all users
 * - admin: Organization management, limited user management
 * - user: Standard access, read-only for most resources
 */
export const users = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  role: text('role', { enum: ['superadmin', 'admin', 'user'] })
    .notNull()
    .default('user'),
  isActive: boolean('is_active').notNull().default(true),
  // Profile role coming from Dyna SSO (e.g. MANAGER, DISTRIBUTION, SELLER...), unrelated to the authorization `role` above
  dynaRole: text('dyna_role'),
  // Per-user scope from Dyna SSO, interpreted against dynaRole: regional group ("1"|"2"|"3") for DISTRIBUTION, a seller_id for SELLER
  scope: text('scope'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  // Index for authorization queries (WHERE role = 'admin')
  roleIdx: index('users_role_idx').on(table.role),
  // Index for active user queries (WHERE is_active = true)
  isActiveIdx: index('users_is_active_idx').on(table.isActive),
  // Composite index for role + active queries
  roleActiveIdx: index('users_role_active_idx').on(table.role, table.isActive),
}));

/**
 * Session table - Manages user sessions for Better Auth
 */
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  // Index for JOIN queries (WHERE user_id = ?)
  userIdIdx: index('session_user_id_idx').on(table.userId),
  // Index for expired session cleanup (WHERE expires_at < NOW())
  expiresAtIdx: index('session_expires_at_idx').on(table.expiresAt),
  // Index for token lookup (WHERE token = ?)
  tokenIdx: index('session_token_idx').on(table.token),
}));

/**
 * Verification table - Stores OTP codes for email verification
 */
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(), // email address
  value: text('value').notNull(), // OTP code
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Changelog subscriber table - Public "Novedades" email list
 *
 * Entries live in code (features/changelog/changelog.entries.ts); this table is
 * the audience. Email is stored normalized (trim + lowercase); the token is the
 * per-subscriber secret behind the one-click unsubscribe link.
 */
export const changelogSubscribers = pgTable('changelog_subscriber', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  token: text('token').notNull().unique(),
  // Web origin the subscriber signed up from (validated against ORIGIN_URL), so
  // their email links and unsubscribe redirect go back to that same site (dev or prod)
  webOrigin: text('web_origin'),
  status: text('status', { enum: ['active', 'unsubscribed'] })
    .notNull()
    .default('active'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  // Index for the digest recipient query (WHERE status = 'active')
  statusIdx: index('changelog_subscriber_status_idx').on(table.status),
}));

/**
 * Changelog digest run table - One row per digest day already sent
 *
 * The in-process scheduler claims a day by inserting its row before sending, so
 * an API restart (or a second instance) never emails the same day twice.
 */
export const changelogDigestRuns = pgTable('changelog_digest_run', {
  digestDate: text('digest_date').primaryKey(), // YYYY-MM-DD in the project timezone
  recipients: integer('recipients').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Binary column (Postgres bytea) mapped to a Node Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

export const supportTicketType = pgEnum('support_ticket_type', ['error', 'data', 'access', 'suggestion']);
export const supportTicketStatus = pgEnum('support_ticket_status', ['open', 'in_progress', 'resolved', 'closed']);
export const supportTicketPriority = pgEnum('support_ticket_priority', ['high', 'medium', 'low']);

/**
 * Support ticket table - In-app support requests ("Soporte")
 *
 * `number` is the public, sequential id shown to users (#12) and used in URLs.
 * `context` is the snapshot of what the requester was looking at (page, filters,
 * dates, role), so a request is reproducible without asking.
 */
export const supportTickets = pgTable('support_ticket', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: serial('number').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: supportTicketType('type').notNull(),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  status: supportTicketStatus('status').notNull().default('open'),
  priority: supportTicketPriority('priority').notNull().default('medium'),
  context: jsonb('context').$type<Record<string, unknown>>().notNull(),
  // Site the request came from (validated against ORIGIN_URL): base for email links
  webOrigin: text('web_origin').notNull(),
  // Novedades entry that solved it (id from changelog.entries.ts)
  changelogEntryId: text('changelog_entry_id'),
  // Whose turn it is: true until an agent answers publicly, back to true on a requester reply
  awaitingTeam: boolean('awaiting_team').notNull().default(true),
  // Requester's answer to "¿Se solucionó?" on a resolved request (null = not answered)
  satisfied: boolean('satisfied'),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  // Drives the 7-day auto-close; cleared when the request is reopened
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userActivityIdx: index('support_ticket_user_activity_idx').on(table.userId, table.lastActivityAt),
  statusIdx: index('support_ticket_status_idx').on(table.status),
  awaitingIdx: index('support_ticket_awaiting_idx').on(table.awaitingTeam, table.lastActivityAt),
  statusResolvedIdx: index('support_ticket_status_resolved_idx').on(table.status, table.resolvedAt),
}));

/**
 * Support message table - The thread of a support ticket
 *
 * `internal` notes are agent-only and are never returned to requesters.
 */
export const supportMessages = pgTable('support_message', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => supportTickets.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  authorIsAgent: boolean('author_is_agent').notNull(),
  internal: boolean('internal').notNull().default(false),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ticketCreatedIdx: index('support_message_ticket_created_idx').on(table.ticketId, table.createdAt),
}));

/**
 * Support screenshot table - Optional JPEG of the screen, one per ticket
 *
 * Kept apart from support_ticket so listing tickets never loads image bytes.
 */
export const supportScreenshots = pgTable('support_screenshot', {
  ticketId: uuid('ticket_id')
    .primaryKey()
    .references(() => supportTickets.id, { onDelete: 'cascade' }),
  mime: text('mime').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Type inference for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type ChangelogSubscriber = typeof changelogSubscribers.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
