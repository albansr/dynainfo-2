import type { BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../../db/postgres/client.js';
import { users, session as sessionTable } from '../../db/postgres/schema.js';
import { eq } from 'drizzle-orm';

interface DynaJWTPayload {
  uid: string;
  email: string;
  nombre: string;
  iat: number;
  exp: number;
}

/**
 * Generate a secure random session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Dyna SSO Plugin for Better Auth
 *
 * Allows users from the external Dyna system to authenticate via JWT token
 * without needing to go through the OTP flow.
 */
export const dynaSSO = (): BetterAuthPlugin => {
  const SSO_SECRET = process.env['SSO_SECRET_KEY'] || '';

  if (!SSO_SECRET) {
    throw new Error('SSO_SECRET_KEY environment variable is required for Dyna SSO plugin');
  }

  return {
    id: 'dyna-sso',
    endpoints: {
      dynaLogin: createAuthEndpoint(
        '/sso/dyna-login',
        {
          method: 'GET',
          query: z.object({
            token: z.string(),
          }),
        },
        async (ctx) => {
          try {
            const { token } = ctx.query;

            // 1. Verify JWT token with Dyna's secret key
            let decoded: DynaJWTPayload;
            try {
              decoded = jwt.verify(token, SSO_SECRET) as DynaJWTPayload;
            } catch (error) {
              ctx.context.logger?.error('Invalid SSO token', error);
              return new Response(
                JSON.stringify({
                  error: 'INVALID_TOKEN',
                  message: 'Invalid or expired SSO token',
                }),
                {
                  status: 401,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            }

            // 2. Find or create user in database using Drizzle
            let user = await db
              .select()
              .from(users)
              .where(eq(users.email, decoded.email))
              .limit(1)
              .then((rows) => rows[0]);

            if (!user) {
              // Create new user with SSO data
              ctx.context.logger?.info('Creating new SSO user for ' + decoded.email);
              const [newUser] = await db
                .insert(users)
                .values({
                  email: decoded.email,
                  name: decoded.nombre,
                  emailVerified: true, // SSO users are pre-verified
                  role: 'user',
                  isActive: true,
                })
                .returning();
              user = newUser!;
            } else {
              // Update user name if it changed
              if (user.name !== decoded.nombre) {
                const [updated] = await db
                  .update(users)
                  .set({ name: decoded.nombre })
                  .where(eq(users.id, user.id))
                  .returning();
                user = updated!;
              }
            }

            // 3. Create session using Drizzle
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            const sessionToken = generateSessionToken();
            const sessionId = generateSessionToken(); // Generate unique session ID

            const [newSession] = await db
              .insert(sessionTable)
              .values({
                id: sessionId,
                userId: user.id,
                expiresAt,
                token: sessionToken,
                ipAddress: ctx.request?.headers.get('x-forwarded-for') ||
                          ctx.request?.headers.get('x-real-ip') ||
                          null,
                userAgent: ctx.request?.headers.get('user-agent') || null,
              })
              .returning();

            ctx.context.logger?.info(
              'SSO session created successfully for user: ' + user.id
            );

            // 4. Set session cookie using Better Auth's native function
            await setSessionCookie(ctx, {
              session: newSession!,
              user: {
                ...user,
                name: user.name || decoded.nombre, // Ensure name is always present
              },
            });

            // 5. Redirect to maintenance page
            const redirectUrl =
              process.env['NODE_ENV'] === 'production'
                ? `${process.env['ORIGIN_URL']}/mantenimiento`
                : 'http://localhost:4000/mantenimiento';

            return new Response(null, {
              status: 302,
              headers: {
                Location: redirectUrl,
                'Cache-Control': 'no-store',
              },
            });
          } catch (error) {
            ctx.context.logger?.error('SSO login failed', error);

            return new Response(
              JSON.stringify({
                error: 'SSO_LOGIN_FAILED',
                message: 'An error occurred during SSO login',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
        }
      ),
    },
  };
};
