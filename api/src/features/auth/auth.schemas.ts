import { Type } from '@sinclair/typebox';

/**
 * Auth API Schemas for Swagger Documentation
 *
 * These schemas document the Better Auth Email OTP flow:
 * 1. Send OTP → 2. Verify OTP → 3. Get Session → 4. Sign Out
 */

// ============ Send OTP ============
export const SendOTPRequestSchema = Type.Object({
  email: Type.String({ format: 'email', description: 'User email address' }),
  type: Type.Union([
    Type.Literal('sign-in'),
    Type.Literal('email-verification'),
    Type.Literal('forget-password'),
  ], { description: 'Type of OTP request (use "sign-in" for login)' }),
  callbackURL: Type.Optional(Type.String({ description: 'URL to redirect after verification' })),
});

export const SendOTPResponseSchema = Type.Object({
  success: Type.Literal(true),
});

// ============ Verify OTP ============
export const VerifyOTPRequestSchema = Type.Object({
  email: Type.String({ format: 'email', description: 'User email address' }),
  otp: Type.String({ minLength: 6, maxLength: 6, description: '6-digit OTP code' }),
});

export const VerifyOTPResponseSchema = Type.Object({
  user: Type.Object({
    id: Type.String({ description: 'User ID' }),
    email: Type.String({ format: 'email', description: 'User email' }),
    emailVerified: Type.Boolean({ description: 'Email verification status' }),
    name: Type.String({ description: 'User display name' }),
    image: Type.Union([Type.String(), Type.Null()], { description: 'Profile image URL' }),
    createdAt: Type.String({ format: 'date-time', description: 'Account creation date' }),
    updatedAt: Type.String({ format: 'date-time', description: 'Last update date' }),
  }),
  session: Type.Object({
    id: Type.String({ description: 'Session ID' }),
    userId: Type.String({ description: 'User ID' }),
    expiresAt: Type.String({ format: 'date-time', description: 'Session expiration date' }),
    token: Type.String({ description: 'Session token (set as cookie)' }),
  }),
});

// ============ Get Session ============
export const GetSessionResponseSchema = Type.Object({
  user: Type.Object({
    id: Type.String({ description: 'User ID' }),
    email: Type.String({ format: 'email', description: 'User email' }),
    emailVerified: Type.Boolean({ description: 'Email verification status' }),
    name: Type.String({ description: 'User display name' }),
    image: Type.Union([Type.String(), Type.Null()], { description: 'Profile image URL' }),
    createdAt: Type.String({ format: 'date-time', description: 'Account creation date' }),
    updatedAt: Type.String({ format: 'date-time', description: 'Last update date' }),
  }),
  session: Type.Object({
    id: Type.String({ description: 'Session ID' }),
    userId: Type.String({ description: 'User ID' }),
    expiresAt: Type.String({ format: 'date-time', description: 'Session expiration date' }),
  }),
});

// ============ Sign Out ============
export const SignOutResponseSchema = Type.Object({
  status: Type.Literal(true),
});

// ============ Error Responses ============
export const AuthErrorSchema = Type.Object({
  type: Type.String({ description: 'Error type URI' }),
  title: Type.String({ description: 'Error title' }),
  status: Type.Number({ description: 'HTTP status code' }),
  detail: Type.String({ description: 'Error details' }),
  instance: Type.String({ description: 'Request path' }),
  traceId: Type.String({ description: 'Request trace ID' }),
});
