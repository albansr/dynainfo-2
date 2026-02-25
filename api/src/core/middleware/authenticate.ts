import type { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../auth/auth.js';

/**
 * Authentication middleware
 *
 * Verifies JWT token and attaches user to request
 * Returns 401 if token is invalid or missing
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify session with Better Auth
    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${token}` }),
    });

    if (!session || !session.user) {
      return reply.status(401).send({
        error: 'Invalid or expired session',
      });
    }

    // Attach user to request for use in route handlers
    (request as any).user = session.user;
  } catch (error) {
    request.log.error({ err: error }, 'Authentication failed');
    return reply.status(401).send({
      error: 'Authentication failed',
    });
  }
}

// Extend Fastify types to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name?: string;
      role?: string;
      emailVerified: boolean;
    };
  }
}
