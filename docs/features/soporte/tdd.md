> Living document · 2026-10-15 · DynaInfo 2.0

# Soporte — technical design

## Context

Implements `prd.md`: in-app support requests with captured context, a message thread, ADMIN agents, email notifications through Resend and a link to Novedades on resolution. Conventions: `.claude/CLAUDE.md`, `.claude/rules/backend.md`, `frontend.md`, `testing.md`, `changelog.md`.

Two facts about the current code shape this design:

- **No cookie-session guard exists.** `api/src/core/middleware/authenticate.ts` only accepts an `Authorization: Bearer` header, but the web app authenticates with cookies (`apiClient` sends `credentials: 'include'`). The data routes (balance, list, festival…) have no session check today. This feature adds a cookie-based guard; the support routes use it, and it can later protect the data routes.
- **The role checks in `authorize.ts` use the legacy `role` column** (`superadmin|admin|user`), not `dyna_role`. Support agents are defined by `dyna_role = 'ADMIN'` read from the session on the server, so a client-side demo or "view as" override never grants agent rights.

## Goals and non-goals

- **Goals:** create, list and thread requests; agent triage (status, priority, internal notes); optional screenshot; email notifications; auto-close after 7 days; link to a Novedades entry; reopen the user's context; "view as" the requester's role.
- **Non-goals:** inbound email replies, free attachments, SLAs, assignment, knowledge base, AI triage (see PRD "Out of scope").

## Architecture decision and alternatives

| Decision | Choice | Alternative and its cost |
|---|---|---|
| Build or buy | In-house feature (`features/support`) | Zoho Desk / Jira SM free tiers: no automatic app context, users leave DynaInfo, separate accounts |
| Storage | Postgres (Drizzle), three tables | ClickHouse: analytics-only and read-only for the app |
| Screenshot | Generated in the browser with `modern-screenshot` as a JPEG, stored as `bytea` in its own table | Object storage (S3/R2): new service and credentials; `html2canvas`: unmaintained and weaker with modern CSS |
| Auth guard | New `requireSession` preHandler using `auth.api.getSession({ headers: fromNodeHeaders(request.headers) })` (`better-auth/node`) | Reuse `authenticate`: rejects cookie sessions, would never work from the web |
| Agent check | `requireSupportAgent`: session user's `dynaRole === 'ADMIN'` | `requireAdmin` (legacy `role` column): not the DynaRoles model |
| Auto-close | In-process interval in the API (hourly), one idempotent `UPDATE` | A cron outside the API: no CI or scheduler infra here (same reasoning as the Novedades digest) |
| Notification recipients | `SUPPORT_NOTIFY_EMAILS` env var (comma-separated), set to `alban.rodriguez95@gmail.com` | Query all ADMIN users: decided against for now (PRD) |
| "View as" role | Tab-scoped override in `sessionStorage`, applied only when the real role (from the server session) is ADMIN, with a banner | Reuse the demo switcher: disabled in production and persisted in `localStorage` |
| Ticket identifier in URLs | Sequential `number` (`/soporte/12`) | uuid in URLs: unfriendly for users and emails |

## Data model

New tables in `api/src/core/db/postgres/schema.ts`, migration `0005_add_support_tickets.sql` (generated with `npm run db:generate`, applied with `db:migrate`; locally `db:push`).

**Enums** (`pgEnum`):
- `support_ticket_type`: `error | data | access | suggestion`
- `support_ticket_status`: `open | in_progress | resolved | closed`
- `support_ticket_priority`: `high | medium | low`

**`support_ticket`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk, `defaultRandom()` | internal id |
| `number` | `serial`, unique, not null | public number `#12` |
| `user_id` | text, not null, FK `user.id` `on delete cascade` | requester |
| `type` | `support_ticket_type`, not null | |
| `subject` | text, not null | 3–120 chars (validated at the route) |
| `description` | text, not null | 10–5000 chars |
| `status` | `support_ticket_status`, not null, default `open` | |
| `priority` | `support_ticket_priority`, not null, default `medium` | |
| `context` | `jsonb`, not null | see "Context shape" |
| `web_origin` | text, not null | site the request came from (validated with `matchWebOrigin`), used for email links |
| `changelog_entry_id` | text, null | id from `CHANGELOG_ENTRIES` |
| `last_activity_at` | timestamptz, not null, default now | updated on every message or status change; list ordering |
| `resolved_at` | timestamptz, null | set on `resolved`, cleared on reopen; drives auto-close |
| `closed_at` | timestamptz, null | |
| `created_at`, `updated_at` | timestamptz, default now | |

Indexes: `(user_id, last_activity_at desc)`, `(status)`, `(status, resolved_at)`.

**`support_message`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `ticket_id` | uuid, FK `support_ticket.id` `on delete cascade`, not null | |
| `author_id` | text, FK `user.id`, not null | |
| `author_is_agent` | boolean, not null | snapshot at write time |
| `internal` | boolean, not null, default false | agent-only note; never returned to non-agents |
| `body` | text, not null | 1–5000 chars, plain text |
| `created_at` | timestamptz, default now | |

Index: `(ticket_id, created_at)`.

**`support_screenshot`**
| Column | Type | Notes |
|---|---|---|
| `ticket_id` | uuid pk, FK `support_ticket.id` `on delete cascade` | one per ticket |
| `mime` | text, not null | always `image/jpeg` |
| `size_bytes` | integer, not null | |
| `data` | `bytea` (Drizzle `customType`) | max 1 MB decoded |
| `created_at` | timestamptz | |

Kept in its own table so listing tickets never loads image bytes.

**Context shape** (`SupportContext`, TypeBox schema shared by validation and types; stored as JSONB):

```ts
{
  path: string;            // location.pathname, max 300
  search: string;          // location.search, max 2000 (filters, view `v`, drill params)
  pageTitle: string;       // document.title, max 200
  dateRange: { start: string; end: string; preset: string | number | null }; // ISO dates from dateRangeStore
  dynaRole: string | null; // effective role in the UI (may be a demo/view-as role)
  scope: string | null;    // effective scope in the UI
  realDynaRole: string | null; // role from the server session (set by the API, not the client)
  userAgent: string;       // max 500
  viewport: { width: number; height: number };
}
```

The API overwrites `realDynaRole` from the session; the client value is ignored.

Types: export `SupportTicket`, `SupportMessage` via `$inferSelect` next to the existing inferred types.

## Backend design

### Middleware — `api/src/core/middleware/`

- **`requireSession.ts`**: `preHandler` calling `auth.api.getSession({ headers: fromNodeHeaders(request.headers) })` (import from `better-auth/node`). No session → `401 { error: 'No autenticado' }`. Attaches `request.sessionUser: { id, email, name, dynaRole, scope }`. Declare the property with a `declare module 'fastify' { interface FastifyRequest { sessionUser?: SessionUser } }` augmentation (no `any`).
- **`requireSupportAgent.ts`**: after `requireSession`; `sessionUser.dynaRole !== 'ADMIN'` → `403`. Export a pure `isSupportAgent(user)` for reuse in the service.

### Feature — `api/src/features/support/`

- **`support.schemas.ts`**: TypeBox schemas: `CreateTicketBody` (`type`, `subject`, `description`, `context`, optional `screenshot` as a base64 string without the `data:` prefix), `ListTicketsQuery` (`scope: 'mine' | 'all'`, optional `status`, `type`, `priority`, `page` ≥1, `limit` 10–50 default 20), `TicketParams` (`number` integer ≥1), `CreateMessageBody` (`body`, optional `internal`), `UpdateTicketBody` (optional `status`, `priority`, `changelogEntryId` string or null), response schemas. Spanish labels are a web concern; the API uses the enum values.
- **`support.service.ts`** (`SupportService`, Drizzle `db` injected like `ChangelogService` for testability):
  - `createTicket(user, input, webOrigin)`: validates the screenshot (decodes base64, checks the JPEG magic bytes `FF D8 FF` and size ≤ 1 MB, else `ValidationError`), inserts the ticket, plus the screenshot if present, in one transaction, sets `context.realDynaRole = user.dynaRole`, returns `{ number }`. Then calls the notifier (new ticket).
  - `listTickets(user, query)`: `scope=all` requires an agent (service throws `ForbiddenError` otherwise); `mine` filters `user_id`. Joins `user` for the requester name and email (agents only). Orders by `last_activity_at desc`. Returns `{ data, total, page, limit }`.
  - `getTicket(user, number)`: not found **or not owner and not agent** → `NotFoundError` (404, avoids enumeration). Returns the ticket, requester `{ name, email }`, `hasScreenshot`, and messages ordered by `created_at`, **excluding `internal` for non-agents**. `context` is returned to agents only; the owner gets `context.path` and `context.search` (for "Abrir pantalla" on their own ticket).
  - `getScreenshot(user, number)`: same visibility rule; returns `{ mime, data }`.
  - `addMessage(user, number, { body, internal })`: `internal` only for agents (else 403). Rejects messages on `closed` tickets (`409 { error: 'La solicitud está cerrada' }`). If the author is the owner and the status is `resolved`, it reopens it (`status=open`, `resolved_at=null`). Updates `last_activity_at`. Notifies: owner message → notification address; public agent message → owner. Internal notes notify nobody.
  - `updateTicket(user, number, patch)` (agents only): allowed transitions: any → `open | in_progress | resolved | closed`. `resolved` sets `resolved_at=now`; leaving `resolved` clears it; `closed` sets `closed_at`. `changelogEntryId` must exist in `CHANGELOG_ENTRIES` and be `published` (else 400). Moving to `resolved` notifies the owner (with the entry link when set). Priority changes and `in_progress` do not notify.
  - `autoCloseResolved(now)`: `UPDATE support_ticket SET status='closed', closed_at=now, updated_at=now WHERE status='resolved' AND resolved_at < now - interval '7 days'`; returns the count. Idempotent, safe with several instances. No email.
  - `openCount()`: count of `open` tickets, for the agent badge.
- **`support.emails.ts`**: pure renderers (subject, HTML, text), like `changelog.digest.ts`; uses `escapeHtml` and `environmentTag(webOrigin)` (a `[DEV]` prefix outside production). Link: `${resolveWebOrigin(ticket.web_origin)}/soporte/${number}`. Templates:
  - New ticket (to `SUPPORT_NOTIFY_EMAILS`): `Nueva solicitud #12 · Dato incorrecto · <subject>`; body with requester name and email, type, description, page path and a button "Ver solicitud".
  - User reply (to `SUPPORT_NOTIFY_EMAILS`): `Respuesta en la solicitud #12 · <subject>`.
  - Agent reply (to the owner): `Te respondimos en la solicitud #12`; body with the reply and "Ver y responder".
  - Resolved (to the owner): `Tu solicitud #12 está resuelta`; body with the latest public agent message, the Novedades link `${origin}/novedades#<entryId>` (requires adding `id={entry.id}` and `scroll-mt` to the card root in `web/src/features/changelog/components/ChangelogEntryCard.tsx`, which has no anchor today) titled "Lo arreglamos: <entry title>" when linked, and "Si sigue pasando, responde en la solicitud antes de 7 días y la reabrimos."
- **`support.notifier.ts`**: sends through the shared `resend` client and `EMAIL_FROM` (`core/email/resend.client.ts`), multipart HTML + text. Errors are logged and never fail the request (same pattern as `changelog.digest.job.ts`). Skips silently when `SUPPORT_NOTIFY_EMAILS` is empty.
- **`support.autoclose.job.ts`**: `startSupportAutoClose()` runs `autoCloseResolved` at start-up and every hour (`setInterval`, `unref()`); returns a stop function. Registered in `server.ts` with an `onClose` hook, like the digest.
- **`support.routes.ts`**: its own plugin, so it can set a larger body limit without affecting the rest of `/api`. All routes have `preHandler: [requireSession]`; agent routes add `requireSupportAgent`.

| Method and path | Guard | Notes |
|---|---|---|
| `POST /api/support/tickets` | session | `bodyLimit: 2_000_000`; rate limit 10 per hour; `webOrigin` from Origin/Referer via `matchWebOrigin` (reuse `requestWebOrigin` from `changelog.routes.ts`: move it to `core/utils/request-origin.ts` and import it in both, since this is its second use) → `201 { number }` |
| `GET /api/support/tickets` | session | `scope=all` → agent (403 otherwise) |
| `GET /api/support/tickets/:number` | session | 404 when not visible |
| `GET /api/support/tickets/:number/screenshot` | session | `image/jpeg`, `Cache-Control: private, max-age=3600`; 404 when none or not visible |
| `POST /api/support/tickets/:number/messages` | session | rate limit 30 per 10 minutes; `201` with the message |
| `PATCH /api/support/tickets/:number` | session + agent | returns the updated ticket |
| `GET /api/support/summary` | session + agent | `{ open: number }` |

Errors go through the existing `core/errors` classes and handler (consistent shape).

### Wiring and configuration

- `api/src/server.ts`: `await fastify.register(supportRoutes, { prefix: '/api' })` next to `changelogRoutes`; start the auto-close job unconditionally (idempotent) and stop it `onClose`.
- `api/src/core/config/env.ts`: `SUPPORT_NOTIFY_EMAILS: z.string().optional().default('')`, parsed into a trimmed list. Add it to `api/.env.example` with an empty value and set `SUPPORT_NOTIFY_EMAILS=alban.rodriguez95@gmail.com` in the real `.env`.
- Dependency (web): `modern-screenshot` (MIT).

## Frontend design

### Feature layout — `web/src/features/support/`

```
features/support/
├── config/support.ts            # Spanish labels, colors and order for type/status/priority
├── hooks/useSupport.ts          # TanStack Query hooks
├── utils/captureContext.ts      # builds SupportContext from location + stores
├── utils/captureScreenshot.ts   # modern-screenshot → base64 JPEG ≤ 1 MB
├── components/SupportDrawer.tsx # HeroUI Drawer with the new-request form
├── components/NewTicketForm.tsx
├── components/TicketList.tsx    # RegionalTable-style list (shared table where it fits)
├── components/TicketThread.tsx  # messages + reply box
├── components/AgentPanel.tsx    # status, priority, Novedades link, context, actions
├── pages/SupportPage.tsx        # /soporte
└── pages/SupportTicketPage.tsx  # /soporte/:number
```

- **Hooks** (`useSupport.ts`): `useSupportTickets(scope, filters, page)` (`['support', 'tickets', scope, filters, page]`), `useSupportTicket(number)` (`['support', 'ticket', number]`), `useSupportSummary()` (agents only, `enabled` by role, `refetchInterval: 60_000`), `useCreateTicket`, `useAddMessage`, `useUpdateTicket`: mutations through `apiClient`, invalidating `['support']`. Rely on the `QueryClient` defaults.
- **Screenshot `<img>`**: `src` = `${API_URL}/api/support/tickets/${n}/screenshot` (cookies go with same-site requests; if not, fetch it as a blob through `apiClient`, which is the safer default: do that).
- **`captureContext()`**: pure function taking `{ location, dateRange, user, realDynaRole, document, window }` so it is unit-testable; trims each field to its max length.
- **`captureScreenshot()`**: `domToJpeg(document.body, { quality: 0.7, scale: min(1, 1600 / innerWidth), filter: (node) => !node.closest?.('[data-support-ignore]') })`. If the result exceeds 1 MB, retry once at quality 0.5; if it still exceeds, skip the screenshot and show a warning toast. The drawer has `data-support-ignore`, and it is closed (hidden) while capturing.

### Entry point — `web/src/core/layouts/AppLayout.tsx`

In the sidebar footer (`mt-auto border-t` block), above the user dropdown: a full-width button "Ayuda y soporte" with `LifebuoyIcon` (`@heroicons/react/24/outline`), `cursor-pointer`. For agents, a `Chip` with the open count from `useSupportSummary()` when greater than 0. The same footer is inside the mobile drawer, so mobile gets it too. Clicking opens `SupportDrawer` (state local to the layout via `useDisclosure`).

### "View as" — real role and tab-scoped override

- `web/src/core/store/authStore.ts`: add `realDynaRole: string | null` and `realScope`, set by `hydrateSessionFromServer` from the server user **before** any override; not persisted from the client (always rehydrated).
- New `web/src/core/store/viewAsStore.ts` (zustand `persist` with `createJSONStorage(() => sessionStorage)`, key `support-view-as`): `{ dynaRole, scope, ticketNumber } | null`, `start(...)`, `stop()`.
- Override precedence in `hydrateSessionFromServer` and a small selector `applyRoleOverrides(user, real, demo, viewAs)` in `web/src/core/utils/roleOverrides.ts` (pure, unit-tested): **view-as** (only if `real.dynaRole === 'ADMIN'`) > **demo** (only if `isDemoRoleEnabled()`) > real. Starting or stopping view-as patches the current user immediately (like `setDemoRole`) and invalidates queries.
- `web/src/core/components/ViewAsBanner.tsx`, rendered at the top of `AppLayout` main content when view-as is active: amber bar "Estás viendo DynaInfo como {rol} · {scope} (solicitud #{n}) · Salir". "Salir" stops view-as and navigates back to `/soporte/{n}`.

### Routes — `web/src/app/App.tsx`

`/soporte` and `/soporte/:number`, both `RouteGuard requireAuth` + `AppLayout`, lazy-loaded like the other pages. Validate `:number` as a positive integer (invalid → the empty/error state, not a cast).

## Screens (UX)

All copy in Spanish. Request is feminine: "la solicitud".

**Labels**
- Type: `error` "Error en la app", `data` "Dato incorrecto", `access` "Acceso o permisos", `suggestion` "Sugerencia".
- Status (chip, color plus text): `open` "Abierta" (primary), `in_progress` "En curso" (warning), `resolved` "Resuelta" (success), `closed` "Cerrada" (default).
- Priority: `high` "Alta", `medium` "Media", `low` "Baja". Shown only to agents.

**Support drawer (new request)**, right side, `size="md"`
- Title "Ayuda y soporte"; subtitle "Cuéntanos qué pasa. Guardamos automáticamente la pantalla, los filtros y las fechas que estás viendo."
- Fields: "Tipo" (radio cards with the four types, required), "Asunto" (input, max 120, placeholder "Ej.: No sale el presupuesto en proveedores"), "Descripción" (textarea, max 5000, placeholder "Qué esperabas ver y qué ves en su lugar"), checkbox "Incluir captura de pantalla" (checked by default for `error` and `data`, unchecked otherwise).
- Collapsible "Qué se envía" listing page, filters, dates and role in plain text (transparency).
- Footer: link "Ver mis solicitudes" (→ `/soporte`) and button "Enviar solicitud" (disabled until type, subject ≥3 and description ≥10 are valid; tooltip "Completa el tipo, el asunto y la descripción").
- While sending: button loading "Enviando…". Success: close the drawer, toast `Solicitud #12 enviada. Te avisaremos por correo.` with an action "Ver". Error: toast `No pudimos enviar la solicitud. Inténtalo de nuevo.`; form content is kept.

**`/soporte`**, page header "Soporte" (`PageHeader`)
- Requester: title "Mis solicitudes", button "Nueva solicitud" (opens the drawer). Table columns: "N.º", "Asunto", "Tipo", "Estado", "Última actividad" (relative, e.g. "hace 2 h"). Whole row clickable (accessible row: `role="button"`, `tabIndex`, Enter/Space, `aria-label="Abrir solicitud #12"`) → `/soporte/12`.
- Agent: tabs "Todas" / "Mis solicitudes"; "Todas" adds columns "Solicitante" and "Prioridad" and filters (AppSelect) for status (default: "Abiertas y en curso"), type and priority.
- Empty (requester): "Aún no has enviado solicitudes. Si algo no funciona o no cuadra, cuéntanoslo desde «Ayuda y soporte»." Empty (agent, filtered): "No hay solicitudes con estos filtros."
- Loading: skeleton rows. Error: "No pudimos cargar las solicitudes." with "Reintentar".

**`/soporte/:number`**
- Header: "#12 · {asunto}", status chip, type, created date. Breadcrumbs "Soporte / #12".
- Left: the description as the first message, then the thread. Agent messages show "Equipo DynaInfo" to requesters and the agent's name to agents. Internal notes (agents only) have a yellow background and the label "Nota interna".
- Reply box: textarea "Escribe una respuesta…", button "Enviar". For agents, a toggle "Nota interna (no la ve el usuario)". On a resolved ticket, the requester sees the hint "Si respondes, reabriremos la solicitud." On a closed ticket the box is replaced by "Esta solicitud está cerrada. Si el problema sigue, abre una nueva solicitud." with a button that opens the drawer.
- Screenshot (if any): thumbnail; click opens it full-size in a modal.
- Requester extra: button "Abrir la pantalla" (navigates to `path + search` and applies the stored date range).
- **Agent panel** (right column, stacks on mobile):
  - "Estado" select and "Prioridad" select: changing them saves immediately, toast "Estado actualizado" / "Prioridad actualizada".
  - When choosing "Resuelta": a modal "Marcar como resuelta" with an optional select "Novedad relacionada" (published `CHANGELOG_ENTRIES`, newest first, from the existing `/api/changelog/entries`) and the text "Enviaremos un correo a {nombre} avisando de que está resuelta." Buttons "Cancelar" / "Marcar como resuelta". Success toast: "Solicitud resuelta y usuario avisado".
  - "Contexto": page, filters (decoded query params as "clave: valor"), dates, role and scope, real role, browser, screen size, requester name and email.
  - Button "Abrir donde estaba" (applies the stored date range to `dateRangeStore`, then navigates to `path + search`).
  - Button "Ver como su rol" (enabled only if the stored `dynaRole` differs from the agent's; tooltip when disabled "El usuario tiene tu mismo rol"). Starts view-as with the ticket's `dynaRole`/`scope`, applies the date range and navigates like "Abrir donde estaba". Banner as described above.
- 404 (not found or not yours): "No encontramos esta solicitud." with a link "Volver a Soporte".

**Confirmations and feedback**
- Only "Marcar como resuelta" uses a confirmation dialog. Every other action saves directly with a sonner toast on success and on error ("No pudimos guardar el cambio. Inténtalo de nuevo.").

## Authorization and security

- Every support endpoint requires a Better Auth cookie session (401). Agent rights come from `dyna_role` in the server session only; client overrides (demo, view-as) never reach the API's checks.
- Ownership is enforced in the service; non-visible tickets return 404.
- Internal notes and full context are filtered on the server, not hidden in the UI.
- Input validation with TypeBox: lengths, enums, JSONB context shape with `additionalProperties: false`; the screenshot is checked by magic bytes and size; `bodyLimit` only on the create route.
- Email content is escaped (`escapeHtml`); links are built only from `web_origin` values validated against `ORIGIN_URL`.
- Rate limits on create and reply (per IP via `@fastify/rate-limit`, already registered).
- Screenshots can show customer data: they are served only through the authenticated endpoint, never embedded in emails, and use `Cache-Control: private`.
- "View as" is UX only, consistent with the frontend-only security model in `CLAUDE.md`: it changes what the UI filters, not what the API allows.

## Testing strategy

Follow `.claude/rules/testing.md`: no real Postgres, Resend or Better Auth.

**API** (`api/test/...`)
- `core/middleware/requireSession.test.ts`: no session → 401; session → `sessionUser` set with `dynaRole`/`scope` (mock `auth.api.getSession`).
- `core/middleware/requireSupportAgent.test.ts`: ADMIN passes; other roles → 403.
- `features/support/support.service.test.ts` (chainable mocked `db`, as in `changelog.service.test.ts`): create (with and without a screenshot, oversize and non-JPEG rejected, `realDynaRole` overwritten); list `mine` vs `all` (non-agent `all` → Forbidden); get hides internal notes and context for owners, 404 for strangers; owner reply reopens a resolved ticket; reply to a closed ticket → 409; internal note by a non-agent → 403; update validates the changelog id (unknown or unpublished → 400) and sets/clears `resolved_at`; notifier called with the right template and recipient in each case; `autoCloseResolved` issues the expected update with the 7-day cutoff (pinned clock).
- `features/support/support.emails.test.ts`: subjects, `[DEV]` tag, escaping, Novedades link present only when linked.
- `features/support/support.routes.test.ts`: status codes and error shape per route, schema validation (bad type, short subject, `limit` out of range), body limit on create.
- `features/support/support.autoclose.job.test.ts`: fake timers; runs on start and every hour; stop clears the interval.

**Web** (colocated `*.test.ts(x)`)
- `utils/captureContext.test.ts`: fields, trimming, date serialisation.
- `core/utils/roleOverrides.test.ts`: precedence view-as > demo > real; view-as ignored when the real role is not ADMIN; demo ignored on production hosts.
- `config/support.test.ts`: every enum value has a Spanish label.
- `components/NewTicketForm.test.tsx`: submit disabled until valid; screenshot checkbox default per type.

**Manual verification in the running app** (`make dev`, web :4000, api :5002)
1. As a non-admin user, open a request with a screenshot from `/distribucion/detalle` with filters; check the toast, the row in `/soporte` and the email received at the notification address.
2. As ADMIN: see it under "Todas", change the priority, add an internal note (confirm the requester does not see it), reply (requester gets an email), use "Abrir donde estaba" (same URL and dates) and "Ver como su rol" (banner, filtered data, "Salir" returns to the ticket).
3. Mark it resolved with a Novedades entry; check the requester's email link. Reply as the requester and confirm it reopens.
4. Set `resolved_at` 8 days back in the local DB, restart the API, and confirm the ticket closes.
5. Calls without a cookie → 401; a requester opening another user's `/soporte/:n` → "No encontramos esta solicitud."

## Rollout plan

1. Migration `0005_add_support_tickets.sql`; run `db:migrate` against the shared database before deploying the API.
2. Set `SUPPORT_NOTIFY_EMAILS=alban.rodriguez95@gmail.com` in the API `.env`; restart the API (new module wiring in `server.ts`).
3. Install `modern-screenshot` in `web`; rebuild the web container.
4. Novedades entry (category `nuevo`) in the same PR, e.g. "Ayuda y soporte desde cualquier pantalla", with a small mockup with fictional data.
5. Branch `feature/support_tickets` → PR to `dev` → `master`.

## Glossary

- **Requester:** the user who opened the request.
- **Agent:** a user whose real Dyna SSO role is ADMIN.
- **Internal note:** a thread message only agents can see.
- **Context:** the snapshot of what the requester was looking at (page, filters, dates, role, browser).
- **View as:** a tab-only mode where an agent sees the UI with the requester's role and scope.
- **Auto-close:** the hourly job that closes requests resolved more than 7 days ago.
