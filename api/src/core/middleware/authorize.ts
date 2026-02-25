import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

/**
 * Role hierarchy: superadmin > admin > user
 */
type Role = 'superadmin' | 'admin' | 'user';

const ROLE_HIERARCHY: Record<Role, number> = {
  superadmin: 3,
  admin: 2,
  user: 1,
};

/**
 * Authorization middleware factory
 *
 * Checks if authenticated user has required role or higher
 * Must be used AFTER authenticate middleware
 *
 * @param requiredRole - Minimum role required to access route
 * @returns Fastify preHandler middleware
 *
 * @example
 * ```ts
 * fastify.get('/admin/users',
 *   { preHandler: [authenticate, authorize('admin')] },
 *   handler
 * );
 * ```
 */
export function authorize(requiredRole: Role) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // User should be attached by authenticate middleware
    const user = request.user;

    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userRole = (user.role as Role) || 'user';
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole];

    if (userLevel < requiredLevel) {
      // Log detailed info internally (for debugging)
      request.log?.warn({
        type: 'authorization_failed',
        userId: user.id,
        userRole,
        requiredRole,
        userLevel,
        requiredLevel,
        url: request.url,
        method: request.method,
      }, 'Authorization failed: insufficient permissions');

      // Throw generic error (no role info exposed to client)
      throw new ForbiddenError('Access denied');
    }
  };
}

/**
 * Check if user is superadmin
 */
export const requireSuperadmin = authorize('superadmin');

/**
 * Check if user is admin or higher
 */
export const requireAdmin = authorize('admin');

/**
 * Check if user is authenticated (any role)
 */
export const requireUser = authorize('user');
