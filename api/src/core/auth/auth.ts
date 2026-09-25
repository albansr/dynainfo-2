import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { db } from '../db/postgres/client.js';
import { users, session, verification } from '../db/postgres/schema.js';
import { sendOTPEmail } from './email.service.js';
import { dynaSSO } from './plugins/sso.plugin.js';

/**
 * Better Auth configuration with Email OTP and SSO plugins
 *
 * Features:
 * - Email OTP authentication (6-digit code, 10-minute expiry)
 * - SSO integration with Dyna system (JWT token validation)
 * - Session management with JWT
 * - Automatic database schema handling
 * - Resend integration for email delivery
 */
export const auth = betterAuth({
  // Database adapter with Drizzle
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session,
      verification,
    },
  }),

  user: {
    additionalFields: {
      dynaRole: {
        type: 'string',
        required: false,
        input: false, // set by the Dyna SSO plugin only, not client-settable
      },
      scope: {
        type: 'string',
        required: false,
        input: false, // set by the Dyna SSO plugin only, not client-settable
      },
    },
  },

  // Email OTP plugin + SSO
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        await sendOTPEmail(email, otp);
      },
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      // Users are provisioned through Dyna SSO (name/role/scope come from the JWT).
      // OTP is a sign-in path for existing users only; never auto-create a bare,
      // role-less account for an unknown email.
      disableSignUp: true,
    }),
    dynaSSO(), // Dyna system SSO with JWT validation
  ],

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes - reduces DB queries
    },
  },

  // Security settings
  secret: process.env['BETTER_AUTH_SECRET']!,
  baseURL: process.env['BETTER_AUTH_URL']!,

  // Trust proxy headers for production
  trustedOrigins: [
    process.env['BETTER_AUTH_URL'],
    // Frontend origin(s), comma-separated (production + preview, e.g. dev.dynainfo.com.co)
    ...(process.env['ORIGIN_URL']?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
    'http://localhost:4000', // Frontend dev server
  ].filter((origin): origin is string => Boolean(origin)),

  // Cookie config. Production keeps Secure + SameSite=None + Partitioned for the
  // cross-site iframe embed; local dev (http, no TLS) uses Lax/insecure so the
  // session cookie is actually stored — otherwise Secure cookies over http are
  // dropped by some clients (e.g. Playwright), breaking login/E2E.
  advanced: {
    defaultCookieAttributes:
      process.env['NODE_ENV'] === 'production'
        ? { sameSite: 'none', secure: true, partitioned: true }
        : { sameSite: 'lax', secure: false },
  },
});

// Export types for use in routes/middleware
export type AuthContext = typeof auth;
