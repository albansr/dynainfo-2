import { Type, type Static } from '@sinclair/typebox';

export const TICKET_TYPES = ['error', 'data', 'access', 'suggestion'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export const TICKET_PRIORITIES = ['high', 'medium', 'low'] as const;

export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

const TicketTypeSchema = Type.Union([
  Type.Literal('error'),
  Type.Literal('data'),
  Type.Literal('access'),
  Type.Literal('suggestion'),
]);
const TicketStatusSchema = Type.Union([
  Type.Literal('open'),
  Type.Literal('in_progress'),
  Type.Literal('resolved'),
  Type.Literal('closed'),
]);
const TicketPrioritySchema = Type.Union([Type.Literal('high'), Type.Literal('medium'), Type.Literal('low')]);

/** A timestamp: a Date in the service, serialized as an ISO string. */
const DateTimeSchema = Type.Unsafe<Date>({ type: 'string', format: 'date-time' });

/** Largest screenshot accepted, decoded (bytes). */
export const SCREENSHOT_MAX_BYTES = 1_000_000;

/**
 * What the requester was looking at when they opened the request.
 * Nullable unions list Null first: Fastify coerces types, and a string branch
 * first would turn null into "". Unknown fields are stripped (removeAdditional).
 */
export const SupportContextSchema = Type.Object(
  {
    path: Type.String({ maxLength: 300 }),
    search: Type.String({ maxLength: 2000 }),
    pageTitle: Type.String({ maxLength: 200 }),
    dateRange: Type.Object(
      {
        start: Type.String({ maxLength: 40 }),
        end: Type.String({ maxLength: 40 }),
        preset: Type.Union([Type.Null(), Type.String({ maxLength: 40 }), Type.Number()]),
      },
      { additionalProperties: false },
    ),
    dynaRole: Type.Union([Type.Null(), Type.String({ maxLength: 40 })]),
    scope: Type.Union([Type.Null(), Type.String({ maxLength: 80 })]),
    // Overwritten on the server from the session; the client value is ignored
    realDynaRole: Type.Optional(Type.Union([Type.Null(), Type.String({ maxLength: 40 })])),
    userAgent: Type.String({ maxLength: 500 }),
    viewport: Type.Object(
      { width: Type.Integer({ minimum: 0 }), height: Type.Integer({ minimum: 0 }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type SupportContext = Static<typeof SupportContextSchema>;

export const CreateTicketBodySchema = Type.Object(
  {
    type: TicketTypeSchema,
    subject: Type.String({ minLength: 3, maxLength: 120 }),
    description: Type.String({ minLength: 10, maxLength: 5000 }),
    context: SupportContextSchema,
    // Base64 JPEG without the data: prefix (about 4/3 of SCREENSHOT_MAX_BYTES)
    screenshot: Type.Optional(Type.String({ minLength: 4, maxLength: 1_400_000 })),
  },
  { additionalProperties: false },
);
export type CreateTicketBody = Static<typeof CreateTicketBodySchema>;

export const ListTicketsQuerySchema = Type.Object({
  scope: Type.Optional(Type.Union([Type.Literal('mine'), Type.Literal('all')])),
  status: Type.Optional(Type.Union([TicketStatusSchema, Type.Literal('active')])),
  type: Type.Optional(TicketTypeSchema),
  priority: Type.Optional(TicketPrioritySchema),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 10, maximum: 50, default: 20 })),
});
export type ListTicketsQuery = Static<typeof ListTicketsQuerySchema>;

export const TicketParamsSchema = Type.Object({
  number: Type.Integer({ minimum: 1 }),
});

export const CreateMessageBodySchema = Type.Object(
  {
    body: Type.String({ minLength: 1, maxLength: 5000 }),
    internal: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type CreateMessageBody = Static<typeof CreateMessageBodySchema>;

export const UpdateTicketBodySchema = Type.Object(
  {
    status: Type.Optional(TicketStatusSchema),
    priority: Type.Optional(TicketPrioritySchema),
    changelogEntryId: Type.Optional(Type.Union([Type.Null(), Type.String({ maxLength: 120 })])),
  },
  { additionalProperties: false, minProperties: 1 },
);
export type UpdateTicketBody = Static<typeof UpdateTicketBodySchema>;

const PersonSchema = Type.Object({ name: Type.Union([Type.String(), Type.Null()]), email: Type.String() });

const TicketSummarySchema = Type.Object({
  number: Type.Integer(),
  type: TicketTypeSchema,
  subject: Type.String(),
  status: TicketStatusSchema,
  priority: TicketPrioritySchema,
  lastActivityAt: DateTimeSchema,
  createdAt: DateTimeSchema,
  // Agents only (the requester of each ticket)
  requester: Type.Optional(PersonSchema),
});

export const ListTicketsResponseSchema = Type.Object({
  data: Type.Array(TicketSummarySchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
});

const MessageSchema = Type.Object({
  id: Type.String(),
  body: Type.String(),
  internal: Type.Boolean(),
  authorIsAgent: Type.Boolean(),
  // Agent names are shown to agents only; requesters see "Equipo DynaInfo"
  authorName: Type.Union([Type.String(), Type.Null()]),
  createdAt: DateTimeSchema,
});

export const TicketDetailSchema = Type.Object({
  number: Type.Integer(),
  type: TicketTypeSchema,
  subject: Type.String(),
  description: Type.String(),
  status: TicketStatusSchema,
  priority: TicketPrioritySchema,
  changelogEntryId: Type.Union([Type.String(), Type.Null()]),
  lastActivityAt: DateTimeSchema,
  resolvedAt: Type.Union([DateTimeSchema, Type.Null()]),
  createdAt: DateTimeSchema,
  hasScreenshot: Type.Boolean(),
  requester: PersonSchema,
  // Full context for agents; only path, search and dateRange for the requester
  context: Type.Object({}, { additionalProperties: true }),
  messages: Type.Array(MessageSchema),
});

export const CreatedTicketSchema = Type.Object({ number: Type.Integer() });
export const MessageResponseSchema = MessageSchema;
export const SummaryResponseSchema = Type.Object({ open: Type.Integer() });
