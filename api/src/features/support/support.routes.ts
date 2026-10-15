import type { FastifyPluginCallback } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ForbiddenError } from '../../core/errors/app-error.js';
import { requireSession, sessionUserOf } from '../../core/middleware/requireSession.js';
import { requireSupportAgent } from '../../core/middleware/requireSupportAgent.js';
import { requestWebOrigin } from '../../core/utils/request-origin.js';
import { SupportService } from './support.service.js';
import {
  CreatedTicketSchema,
  CreateMessageBodySchema,
  CreateTicketBodySchema,
  FeedbackBodySchema,
  ListTicketsQuerySchema,
  ListTicketsResponseSchema,
  MySummaryResponseSchema,
  MessageResponseSchema,
  SummaryResponseSchema,
  TicketDetailSchema,
  TicketParamsSchema,
  UpdateTicketBodySchema,
} from './support.schemas.js';

/** Room for a base64 screenshot (≤ 1 MB decoded) plus the form, on the create route only. */
const CREATE_BODY_LIMIT = 2_000_000;

/**
 * Support routes ("Soporte"). Every route needs a cookie session; triage needs a
 * support agent (real dyna_role ADMIN). Visibility of each ticket is enforced in
 * the service. Its own plugin, so the larger body limit stays on one route.
 */
export const supportRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const service = new SupportService();
  const tags = ['support'];

  server.post(
    '/support/tickets',
    {
      bodyLimit: CREATE_BODY_LIMIT,
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
      preHandler: [requireSession],
      schema: {
        description: 'Open a support request with its captured context and optional screenshot',
        tags,
        body: CreateTicketBodySchema,
        response: { 201: CreatedTicketSchema },
      },
    },
    async (request, reply) => {
      const webOrigin = requestWebOrigin(request);
      if (!webOrigin) throw new ForbiddenError('Origen no permitido');
      const created = await service.createTicket(sessionUserOf(request), request.body, webOrigin);
      return reply.code(201).send(created);
    },
  );

  server.get(
    '/support/tickets',
    {
      preHandler: [requireSession],
      schema: {
        description: 'Support requests: your own (scope=mine) or all of them for agents (scope=all)',
        tags,
        querystring: ListTicketsQuerySchema,
        response: { 200: ListTicketsResponseSchema },
      },
    },
    async (request, reply) => {
      return reply.code(200).send(await service.listTickets(sessionUserOf(request), request.query));
    },
  );

  server.get(
    '/support/tickets/:number',
    {
      preHandler: [requireSession],
      schema: {
        description: 'A support request with its thread (404 when it is not yours)',
        tags,
        params: TicketParamsSchema,
        response: { 200: TicketDetailSchema },
      },
    },
    async (request, reply) => {
      return reply.code(200).send(await service.getTicket(sessionUserOf(request), request.params.number));
    },
  );

  server.get(
    '/support/tickets/:number/screenshot',
    {
      preHandler: [requireSession],
      schema: {
        description: 'The request screenshot (JPEG)',
        tags,
        params: TicketParamsSchema,
      },
    },
    async (request, reply) => {
      const { mime, data } = await service.getScreenshot(sessionUserOf(request), request.params.number);
      return reply.code(200).type(mime).header('Cache-Control', 'private, max-age=3600').send(data);
    },
  );

  server.post(
    '/support/tickets/:number/messages',
    {
      config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
      preHandler: [requireSession],
      schema: {
        description: 'Reply in a support request (agents may write internal notes)',
        tags,
        params: TicketParamsSchema,
        body: CreateMessageBodySchema,
        response: { 201: MessageResponseSchema },
      },
    },
    async (request, reply) => {
      const message = await service.addMessage(sessionUserOf(request), request.params.number, request.body);
      return reply.code(201).send(message);
    },
  );

  server.post(
    '/support/tickets/:number/feedback',
    {
      preHandler: [requireSession],
      schema: {
        description: 'The requester answers "¿Se solucionó?" on a resolved request (closes or reopens it)',
        tags,
        params: TicketParamsSchema,
        body: FeedbackBodySchema,
        response: { 200: TicketDetailSchema },
      },
    },
    async (request, reply) => {
      return reply
        .code(200)
        .send(await service.giveFeedback(sessionUserOf(request), request.params.number, request.body));
    },
  );

  server.patch(
    '/support/tickets/:number',
    {
      preHandler: [requireSession, requireSupportAgent],
      schema: {
        description: 'Triage a support request: status, priority and the Novedades entry that solved it',
        tags,
        params: TicketParamsSchema,
        body: UpdateTicketBodySchema,
        response: { 200: TicketDetailSchema },
      },
    },
    async (request, reply) => {
      return reply
        .code(200)
        .send(await service.updateTicket(sessionUserOf(request), request.params.number, request.body));
    },
  );

  server.get(
    '/support/summary/mine',
    {
      preHandler: [requireSession],
      schema: {
        description: "The user's own active requests, and how many wait for their answer",
        tags,
        response: { 200: MySummaryResponseSchema },
      },
    },
    async (request, reply) => {
      return reply.code(200).send(await service.mySummary(sessionUserOf(request)));
    },
  );

  server.get(
    '/support/summary',
    {
      preHandler: [requireSession, requireSupportAgent],
      schema: {
        description: 'Active support requests, and how many wait for the team (agents)',
        tags,
        response: { 200: SummaryResponseSchema },
      },
    },
    async (_request, reply) => {
      return reply.code(200).send(await service.summary());
    },
  );

  done();
};
