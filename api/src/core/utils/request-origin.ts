import type { FastifyRequest } from 'fastify';
import { matchWebOrigin } from '../config/web-origin.js';

/** The request's web origin (Origin, or failing that the Referer's) if it is one of ours. */
export function requestWebOrigin(request: FastifyRequest): string | null {
  const { origin, referer } = request.headers;
  if (origin) return matchWebOrigin(origin);
  if (!referer) return null;
  try {
    return matchWebOrigin(new URL(referer).origin);
  } catch {
    return null;
  }
}
