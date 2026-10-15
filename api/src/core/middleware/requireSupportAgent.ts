import type { FastifyRequest } from 'fastify';
import { ForbiddenError } from '../errors/app-error.js';
import type { SessionUser } from './requireSession.js';

/**
 * Support agents: users whose real Dyna SSO role is ADMIN, or superadmins of the
 * user table. Read from the server session only: client-side role overrides
 * (demo, "view as") never grant agent rights.
 */
export function isSupportAgent(user: Pick<SessionUser, 'dynaRole' | 'role'>): boolean {
  return user.dynaRole === 'ADMIN' || user.role === 'superadmin';
}

/** Require a support agent. Use after `requireSession`; non-agents → 403. */
export function requireSupportAgent(request: FastifyRequest): Promise<void> {
  const user = request.sessionUser;
  return user && isSupportAgent(user)
    ? Promise.resolve()
    : Promise.reject(new ForbiddenError('Solo para el equipo de soporte'));
}
