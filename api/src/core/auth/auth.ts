import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { db } from '../db/postgres/client.js';
import { users, session, verification } from '../db/postgres/schema.js';
import { sendOTPEmail } from './email.service.js';

/**
 * Better Auth configuration with Email OTP plugin
 *
 * Features:
 * - Email OTP authentication (6-digit code, 10-minute expiry)
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

  // Email OTP plugin
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        await sendOTPEmail(email, otp);
      },
      otpLength: 6,
      expiresIn: 600, // 10 minutes
    }),
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
    'http://localhost:4000', // Frontend dev server
  ],
});

// Export types for use in routes/middleware
export type AuthContext = typeof auth;
