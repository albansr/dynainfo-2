import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { matchWebOrigin, resolveWebOrigin } from '../../core/config/web-origin.js';
import { ChangelogService } from './changelog.service.js';
import { publishedEntries } from './changelog.entries.js';
import {
  ChangelogEntriesResponseSchema,
  OkResponseSchema,
  SubscribeBodySchema,
  UnsubscribeQuerySchema,
} from './changelog.schemas.js';

/** The request's web origin (Origin, or failing that the Referer's) if it is one of ours. */
function requestWebOrigin(request: FastifyRequest): string | null {
  const { origin, referer } = request.headers;
  if (origin) return matchWebOrigin(origin);
  if (!referer) return null;
  try {
    return matchWebOrigin(new URL(referer).origin);
  } catch {
    return null;
  }
}

/**
 * Public Novedades routes — no session (no `authenticate` preHandler).
 *
 * Subscribing is single opt-in (active immediately). Abuse of the public
 * endpoint is mitigated by: an Origin/Referer allowlist (our own web app only —
 * a layer, not a strong control, since Origin is forgeable server-side), a
 * honeypot field, and a tighter per-route rate limit on top of the global one.
 * Unsubscribe is authorized only by the per-subscriber token. The digest content
 * is non-sensitive and every email has a one-click unsubscribe, so the blast
 * radius of an unwanted subscription is low.
 */
export const changelogRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const service = new ChangelogService();

  // Mail providers send the one-click POST as a form body (List-Unsubscribe=One-Click).
  // The token is in the query string, so the body is accepted and ignored. Scoped to
  // this plugin, so it doesn't change content-type handling for the rest of /api.
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, _body, done) => done(null, {})
  );

  server.get(
    '/changelog/entries',
    {
      schema: {
        description: 'Published Novedades entries, newest first',
        tags: ['changelog'],
        response: { 200: ChangelogEntriesResponseSchema },
      },
    },
    async (_request, reply) => {
      return reply.code(200).send({ entries: publishedEntries() });
    }
  );

  server.post(
    '/changelog/subscribe',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        description: 'Subscribe an email to the Novedades digest (single opt-in)',
        tags: ['changelog'],
        body: SubscribeBodySchema,
        response: { 200: OkResponseSchema, 403: OkResponseSchema },
      },
    },
    async (request, reply) => {
      const webOrigin = requestWebOrigin(request);
      if (!webOrigin) {
        return reply.code(403).send({ ok: false });
      }
      // Honeypot tripped → pretend success, do nothing
      if (request.body.website?.trim()) {
        return reply.code(200).send({ ok: true });
      }
      await service.subscribe(request.body.email, webOrigin);
      // Always the same generic outcome (enumeration-safe)
      return reply.code(200).send({ ok: true });
    }
  );

  // Visible "Darse de baja" link in the email → unsubscribe + confirmation page
  server.get(
    '/changelog/unsubscribe',
    {
      schema: {
        description: 'Unsubscribe from the Novedades digest (email link)',
        tags: ['changelog'],
        querystring: UnsubscribeQuerySchema,
      },
    },
    async (request, reply) => {
      const subscriber = await service.unsubscribe(request.query.token);
      // Back to the site they subscribed from (dev or prod); re-checked against ORIGIN_URL
      return reply.redirect(`${resolveWebOrigin(subscriber?.webOrigin)}/novedades/baja`);
    }
  );

  // RFC 8058 one-click unsubscribe (List-Unsubscribe-Post from Gmail/Yahoo)
  server.post(
    '/changelog/unsubscribe',
    {
      schema: {
        description: 'One-click unsubscribe (List-Unsubscribe-Post)',
        tags: ['changelog'],
        querystring: UnsubscribeQuerySchema,
        response: { 200: OkResponseSchema },
      },
    },
    async (request, reply) => {
      await service.unsubscribe(request.query.token);
      return reply.code(200).send({ ok: true });
    }
  );

  done();
};
