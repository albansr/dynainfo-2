import type { FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.js';
import { UnauthorizedError } from '../errors/app-error.js';

/** The signed-in user, as read from the Better Auth session on the server. */
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  /** Authorization role of the user table (superadmin | admin | user). */
  role: string | null;
  /** Profile role from the Dyna SSO (ADMIN, MANAGER, SELLER…). */
  dynaRole: string | null;
  scope: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }
}

/** Session user fields as Better Auth returns them (additional fields included). */
interface RawSessionUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  dynaRole?: string | null;
  scope?: string | null;
}

/**
 * Require a Better Auth cookie session (the web app's login).
 *
 * Unlike `authenticate` (Bearer header only), this reads the session from the
 * request cookies, so it works for calls from the web app. No session → 401.
 * Attaches `request.sessionUser`.
 */
export async function requireSession(request: FastifyRequest): Promise<void> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session?.user) throw new UnauthorizedError('No autenticado');
  const user = session.user as RawSessionUser;
  request.sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role ?? null,
    dynaRole: user.dynaRole ?? null,
    scope: user.scope ?? null,
  };
}

/** The session user set by `requireSession` (throws 401 if the guard did not run). */
export function sessionUserOf(request: FastifyRequest): SessionUser {
  if (!request.sessionUser) throw new UnauthorizedError('No autenticado');
  return request.sessionUser;
}
