# DynaInfo 2.0 — Project Configuration

@~/.claude/settings/claude.md

> Sales analytics platform over data in ClickHouse: dashboards, drillable
> listings and Festival Virtual, with role-based access driven by the Dyna SSO.

## Conventions (always read)

The detailed rules live in **`.claude/rules/`** — they are mandatory:

| Rule | Covers |
|------|--------|
| [`frontend.md`](rules/frontend.md) | React/Vite/HeroUI, Tailwind v4, state (TanStack Query vs Zustand vs useState), feature architecture, DynaRoles access, cursor-pointer, Spanish UI |
| [`backend.md`](rules/backend.md) | Fastify features (service+routes+schemas), Drizzle + ClickHouse query builder, Better Auth + Dyna SSO, session-gated endpoints |
| [`testing.md`](rules/testing.md) | Vitest (API), mocking external systems, principles first |
| [`git.md`](rules/git.md) | Branch naming, commit rules (no "fix", no AI attribution, never push), PRs against `dev` |
| [`docs.md`](rules/docs.md) | PRD/TDD conventions + the `/feature` → `/implement` flow |

## Tech Stack

**Backend:** Fastify 5 + TypeScript 5.7 · PostgreSQL (auth) + ClickHouse (analytics) · Better Auth + Resend · Drizzle ORM
**Frontend:** React 19 + Vite 7 · HeroUI + Tailwind CSS 4 · TanStack Query + Zustand · React Router 7

## Architecture

```
dynainfo-2/
├── api/                    # Fastify API (port 5002; /docs, /health)
│   └── src/
│       ├── core/          # auth (Better Auth + Dyna SSO), db (postgres/clickhouse), config, errors, utils
│       ├── features/      # auth, balance, festival, labels, list, qube6, users (service + routes + schemas)
│       └── server.ts
├── web/                    # React + Vite (port 4000)
│   └── src/
│       ├── app/App.tsx    # routes (React Router) — thin
│       ├── core/          # api (client+hooks), components (RegionalTable, analytics/*), config (access, analysisViews…), store
│       └── features/      # auth, dashboard, festival, settings…
├── docs/                   # feature docs (PRD/TDD under docs/features/)
├── docker-compose.yml      # dev stack (web, postgres)
└── Makefile
```

## Access model (DynaRoles)

- Two fields from the Dyna SSO JWT, persisted on `user`: **`dyna_role`** (profile) + **`scope`** (per-user: regional group `"1"|"2"|"3"` for `DISTRIBUTION`, a `seller_id` for `SELLER`).
- Catalog: `ADMIN`, `MANAGER`, `BOARD`, `RETAIL`, `NEW_CHANNELS`, `DISTRIBUTION`, `SELLER`. Single source of truth: `web/src/core/config/access.ts`.
- Each role gates pages/views, temporality presets, years, Excel export and a data filter. **Security is frontend-only for now** (backend enforcement is a later phase).

## Project Commands

```bash
make dev           # DB + Frontend in Docker, API local with hot reload
make up / make down
make test          # tests
```
Local DB schema sync: `cd api && npm run db:push`.

## Quality rules (cross-cutting)

1. **DRY:** if something repeats 2+ times, extract it (hook/util/service/component) — search for an existing helper first.
2. **Data endpoints require a session** (Better Auth) → no session = 401. The real gate is the API.
3. **Validate inputs** (zod / route schemas), correct HTTP codes; sanitize anything interpolated into ClickHouse SQL.
4. **No `console.log`, no dead code, no unused imports** in finished work.
5. **Never commit unless asked; never push automatically; never use "fix"; no AI attribution** (see `git.md`).
6. **A change isn't done until it runs** — exercise the affected route in the running app (`web :4000`, `api :5002`), not just a green typecheck.
