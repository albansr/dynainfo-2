import { pgTable, uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';

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

// Type inference for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
