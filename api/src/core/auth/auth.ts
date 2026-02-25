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

  // Email OTP plugin + SSO
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        await sendOTPEmail(email, otp);
      },
      otpLength: 6,
      expiresIn: 600, // 10 minutes
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
    process.env['BETTER_AUTH_URL']!,
    process.env['ORIGIN_URL']!, // Frontend Vercel/production URL
    'http://localhost:4000', // Frontend dev server
  ],

  // Advanced cookie configuration for cross-site iframe support
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'none', // Allow cookies in cross-site contexts (iframes)
      secure: true, // HTTPS only (required with sameSite: "none")
      partitioned: true, // Modern browser privacy standard (CHIPS)
    },
  },
});

// Export types for use in routes/middleware
export type AuthContext = typeof auth;
