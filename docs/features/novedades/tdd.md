> Living document · 2026-10-07 · DynaInfo 2.0

# Novedades — technical design

## Context

Implements the PRD in `prd.md` from the `changelog-email-digest` playbook, adapted to this stack. Conventions for maintaining it live in `.claude/rules/changelog.md`.

## Goals & non-goals

- **Goals:** public entries page, public single opt-in list, daily digest with one-click unsubscribe, no duplicate sends.
- **Non-goals:** per-role content, double opt-in, an admin UI to manage subscribers.

## Architecture decision

| Decision | Choice | Alternative and its cost |
|---|---|---|
| Where entries live | Typed list in the API (`changelog.entries.ts`), served to the web | In the web bundle (playbook default): the API could not render the digest without a second copy |
| Where the digest runs | In-process scheduler in the API, enabled by `CHANGELOG_DIGEST_ENABLED` | GitHub Actions cron (playbook default): there is no CI here, and it needs the production API reachable from the internet plus a shared token |
| Dev vs prod links | Store each subscriber's `web_origin` (validated against `ORIGIN_URL`) and build their links from it | One env var per environment: impossible here, dev and prod share one API and one `.env` |
| Duplicate protection | Claim the day in `changelog_digest_run` before sending | None: a restart after 08:00 would resend the whole day |
| Audience | Public list | Signed-in users only: simpler, but excludes people outside the app |

Because the job runs next to the data, the playbook's token-protected `GET /recipients` feed and `CHANGELOG_DIGEST_TOKEN` are not needed.

## Data model

- `changelog_subscriber`: `id` uuid pk, `email` unique (trimmed, lowercased), `token` unique (24 random bytes, base64url), `web_origin` (site the subscriber came from), `status` `active | unsubscribed`, `created_at`, `unsubscribed_at`, `updated_at`. Index on `status`.
- `changelog_digest_run`: `digest_date` text pk (`YYYY-MM-DD`, Bogota), `recipients` integer, `sent_at`.
- Migration: `0004_add_changelog_subscriptions.sql`.

## Backend design (`api/src/features/changelog`)

| Endpoint | Auth | Behaviour |
|---|---|---|
| `GET /api/changelog/entries` | none | Published entries, newest first |
| `POST /api/changelog/subscribe` `{ email, website? }` | Origin/Referer allowlist, honeypot, 5/min rate limit | Idempotent upsert to `active`; always `{ ok: true }`; filled honeypot is a silent no-op; foreign origin is `403` |
| `GET /api/changelog/unsubscribe?token=` | token | Unsubscribe, then `302` to `/novedades/baja` on the subscriber's own site (primary origin as fallback) |
| `POST /api/changelog/unsubscribe?token=` | token | RFC 8058 one-click (form body accepted and ignored); `200` |

- `changelog.digest.ts`: pure helpers (previous day, date and hour in a timezone, subject/HTML/text render).
- `changelog.digest.job.ts`: `sendDigestForDate`, `runDigestTick`, `startDigestScheduler` (15-minute tick, from 08:00 America/Bogota, stopped on server close).
- Shared pieces: `core/email/resend.client.ts` (Resend client and sender), `core/config/web-origin.ts` (`webOrigins`, `primaryWebOrigin`, also used by auth and SSO).
- The routes are a separate Fastify plugin so their form-body parser does not affect the rest of `/api`.

## Frontend design (`web/src/features/changelog`)

- `pages/NovedadesPage.tsx` (`/novedades`) and `pages/NovedadesBajaPage.tsx` (`/novedades/baja`): public routes without `RouteGuard`, inside `PublicPageShell`.
- `hooks/useChangelog.ts`: `useChangelogEntries` (TanStack Query) and `useSubscribeToChangelog` (mutation).
- `components/SubscribeForm.tsx`, `components/ChangelogEntryCard.tsx`; `utils/changelogFormat.ts` for bold splitting, Spanish dates and category display.

## Screens (UX)

- **Novedades:** title "Novedades", subtitle "Las mejoras de DynaInfo, de la más reciente a la más antigua.", subscribe card, then one card per entry with date, title, summary and category chips (Nuevo, Mejorado, Corregido).
- **Subscribe form:** field "Tu correo", button "Suscribirme". Invalid email: "Introduce un correo válido." Success (inline, replaces the form): "Listo. Te avisaremos por correo de cada novedad. Puedes darte de baja cuando quieras." Rate limited: "Demasiados intentos. Espera un minuto y vuelve a intentarlo." Other errors: "No hemos podido completar la suscripción. Revisa el correo y vuelve a intentarlo."
- **States:** loading skeletons; empty "Todavía no hay novedades publicadas."; error "No hemos podido cargar las novedades. Vuelve a intentarlo más tarde."
- **Baja:** "Te has dado de baja", explanation, and a "Ver novedades" link back.
- **Email:** subject "Novedades DynaInfo · {title}" (or "· N novedades"), button "Ver todas las novedades", footer with "Darse de baja". Outside production the subject is prefixed with the environment (`[DEV] …`) and the header reads "Novedades de DynaInfo · Entorno DEV" on an amber label.

## Authorization & security

- Public endpoints carry no session and expose no subscriber data.
- Subscribe is enumeration-safe. The Origin allowlist is a layer, not a strong control; double opt-in is the upgrade path.
- Unsubscribe tokens are unguessable and are the only credential for leaving the list.

## Testing strategy (Vitest, external systems mocked)

- API: `test/features/changelog/` covers the service (idempotency, normalization, claim), routes (origin, honeypot, validation, rate limit, redirect, one-click form body), render helpers, and the job (empty day, already sent, per-recipient send, partial failure, 08:00 window).
- Web: `changelogFormat.test.ts` covers bold splitting, date formatting and email validation.

## Rollout plan

1. Merge to `dev` with the new entry `published: false`. Apply the migration.
2. Set `CHANGELOG_DIGEST_ENABLED=true` only in the environment that should send emails, with `RESEND_API_KEY` and a public `BETTER_AUTH_URL`.
3. On `dev → master`, publish the entry with its real date. The next morning at 08:00 Bogota, subscribers get the first digest.

## Glossary

- **Digest:** the daily email with the previous day's entries.
- **One-click unsubscribe:** the `List-Unsubscribe-Post` mechanism that lets mail clients unsubscribe without opening a page.
- **Honeypot:** a hidden form field that only bots fill in.
