---
description: Novedades (changelog) entries, public subscription and the daily email digest
paths:
  - "api/src/features/changelog/**"
  - "web/src/features/changelog/**"
---

# Novedades — changelog and email digest

Adapted from the `changelog-email-digest` playbook. Design and decisions: `docs/features/novedades/`.

## Single source of truth

- Entries live ONLY in **`api/src/features/changelog/changelog.entries.ts`** (typed, newest first). They power the public `/novedades` page (via `GET /api/changelog/entries`) and the daily digest email. Never duplicate the copy anywhere else.
- Subscribers live in Postgres **`changelog_subscriber`**; sent days in **`changelog_digest_run`**. **Entries = code, audience = DB.**

## Every user-facing change ships an entry

- A feature (or any relevant user-facing change) is not done without an entry, added in the **same PR** as the change — like tests.
- Copy in **Spanish**, concrete and not salesy. Lead each item with a short `**bold**` phrase, then a plain explanation. Category: `nuevo` / `mejorado` / `corregido`.
- **Images are mini mockups per item** (default): an item can be `{ text, image: { src, alt } }` with a small mockup (one piece, ~150 px tall) right under its text — only where it helps; changes that remove something stay text-only. A large entry-level `image` is only for big launches (a whole new screen). Files live under `web/public/novedades/` and render on the page and in the email (absolute URL).
- **Mockups always use fictional figures — never a screenshot with real customer data**, since the page and the email are public. Always write the `alt` text.
- After adding a file to `web/public/`, restart the web dev container (`docker restart dynainfo-web`): Vite only indexes public files at startup.
- `published: false` while on `dev`; flip to `true` and set the real go-live `date` (plain `YYYY-MM-DD`, Bogota) on the `dev → master` deploy. The digest only emails **published** entries dated the **previous day**.

## The digest

- Runs **inside the API** (`changelog.digest.job.ts`), only when `CHANGELOG_DIGEST_ENABLED=true`. Every 15 minutes, from **08:00 America/Bogota**, it sends the previous day's entries. An empty day sends nothing.
- A day is claimed in `changelog_digest_run` **before** sending, so restarts or a second instance never send it twice. Don't remove the claim.
- One email per active subscriber, multipart (HTML + text), with a personal unsubscribe link and `List-Unsubscribe` + `List-Unsubscribe-Post` headers (RFC 8058). The link is built on `BETTER_AUTH_URL` (the API's public URL).
- **Dev and prod share one API and one database.** Each subscriber stores the `web_origin` they subscribed from (validated against `ORIGIN_URL`), so their links, images and the unsubscribe redirect point back to that same site, and non-production sites get an environment tag in the subject and header (`[DEV] Novedades DynaInfo · …`). Production is the first `ORIGIN_URL`. Don't replace this with a per-environment env var: one shared API has one `.env`.
- Because the API is shared, `published` applies to both sites at once.
- Email goes through the shared Resend client (`core/email/resend.client.ts`) and `EMAIL_FROM`.

## Public endpoints (anti-abuse)

- `/api/changelog/*` has **no session**, and is registered as its **own plugin** in `server.ts`: it adds a form-body parser for one-click unsubscribe that must not leak into the rest of `/api`.
- Subscribe is single opt-in, idempotent and enumeration-safe (always the same generic `200`). Defended by an Origin/Referer allowlist (`webOrigins()`), a honeypot field (`website`) and a 5/min per-route rate limit. Unsubscribe is **token-only**.
- If the list ever opens to cold/public audiences at scale, move to double opt-in: add a `pending` status and a confirmation token; only `active` rows get the digest.

## When maintaining

- Compare dates as plain `YYYY-MM-DD` strings, never through `new Date()` in local time, or a day can shift and the previous-day window misses it.
- After touching the wiring in `server.ts`, restart the API dev server (watchers can miss new module wiring).
