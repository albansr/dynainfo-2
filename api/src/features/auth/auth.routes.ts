import type { FastifyInstance } from 'fastify';
import { auth } from '../../core/auth/auth.js';
import {
  SendOTPRequestSchema,
  SendOTPResponseSchema,
  VerifyOTPRequestSchema,
  VerifyOTPResponseSchema,
  GetSessionResponseSchema,
  SignOutResponseSchema,
  AuthErrorSchema,
} from './auth.schemas.js';

/**
 * Authentication routes - Email OTP flow
 *
 * Better Auth provides these documented endpoints:
 * 1. POST /api/auth/email-otp/send-verification-otp - Request OTP code
 * 2. POST /api/auth/sign-in/email-otp - Sign in with OTP code
 * 3. GET /api/auth/get-session - Get current session
 * 4. POST /api/auth/sign-out - End session
 *
 * Session management:
 * - Sessions last 7 days
 * - Automatically renewed via cookie
 * - No refresh token needed
 */
export async function authRoutes(fastify: FastifyInstance) {
  /**
   * Helper to forward requests to Better Auth
   */
  const forwardToBetterAuth = async (request: any, reply: any) => {
    const protocol = request.protocol;
    const host = request.headers.host || 'localhost:3000';
    const url = `${protocol}://${host}${request.url}`;

    const webRequest = new Request(url, {
      method: request.method,
      headers: request.headers as HeadersInit,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? JSON.stringify(request.body)
        : undefined,
    });

    const authResponse = await auth.handler(webRequest);
    reply.status(authResponse.status);

    authResponse.headers.forEach((value, key) => {
      reply.header(key, value);
    });

    const responseBody = await authResponse.text();
    return reply.send(responseBody);
  };

  // ============ Step 1: Request OTP ============
  fastify.post(
    '/api/auth/email-otp/send-verification-otp',
    {
      schema: {
        description: 'Send OTP code to email (Step 1 of login)',
        tags: ['Authentication'],
        body: SendOTPRequestSchema,
        response: {
          200: SendOTPResponseSchema,
          400: AuthErrorSchema,
          500: AuthErrorSchema,
        },
      },
    },
    forwardToBetterAuth
  );

  // ============ Step 2: Sign In with OTP ============
  fastify.post(
    '/api/auth/sign-in/email-otp',
    {
      schema: {
        description: 'Sign in with email and OTP code (Step 2 of login)',
        tags: ['Authentication'],
        body: VerifyOTPRequestSchema,
        response: {
          200: VerifyOTPResponseSchema,
          400: AuthErrorSchema,
          401: AuthErrorSchema,
          500: AuthErrorSchema,
        },
      },
    },
    forwardToBetterAuth
  );

  // ============ Step 3: Get Current Session ============
  fastify.get(
    '/api/auth/get-session',
    {
      schema: {
        description: 'Get current session (requires cookie)',
        tags: ['Authentication'],
        response: {
          200: GetSessionResponseSchema,
          401: AuthErrorSchema,
        },
      },
    },
    forwardToBetterAuth
  );

  // ============ Step 4: Sign Out ============
  fastify.post(
    '/api/auth/sign-out',
    {
      schema: {
        description: 'Sign out and end session',
        tags: ['Authentication'],
        response: {
          200: SignOutResponseSchema,
          500: AuthErrorSchema,
        },
      },
    },
    forwardToBetterAuth
  );

  // ============ Catch-all for other Better Auth endpoints ============
  // (e.g., internal endpoints, callbacks, etc.)
  // Hidden from Swagger docs - internal use only
  fastify.all(
    '/api/auth/*',
    {
      schema: {
        hide: true, // Hide from Swagger documentation
      },
    },
    forwardToBetterAuth
  );
}
