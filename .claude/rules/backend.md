---
description: Backend rules for dynainfo-2/api (Fastify 5 + Drizzle + PostgreSQL + ClickHouse)
paths:
  - "api/**/*.ts"
---

# Backend — dynainfo-2/api

Fastify 5 + TypeScript. **PostgreSQL** (Better Auth, via Drizzle ORM) for auth/users; **ClickHouse** (external) for analytics. Port **5002**. Docs at `/docs`, health at `/health`.

## Architecture

```
api/src/
├── core/
│   ├── auth/              # Better Auth (auth.ts) + plugins (Dyna SSO JWT: sso.plugin.ts)
│   ├── db/
│   │   ├── postgres/      # Drizzle client + schema.ts + migrations
│   │   └── clickhouse/    # client + query/ (analytics query builder, filter builder…)
│   ├── config/            # config, dimensions.config (ALLOWED_DIMENSIONS)
│   ├── errors/ middleware/ schemas/ utils/
│   └── ...
├── features/{name}/       # auth, balance, festival, labels, list, qube6, users
│   ├── {name}.service.ts  # business logic (queries via the ClickHouse builder)
│   ├── {name}.routes.ts   # Fastify routes (thin: parse → service → reply)
│   └── {name}.schemas.ts  # request/response schemas + parsing helpers
└── server.ts              # bootstrap
```

- Features are **service + routes + schemas**. Routes stay thin; business logic and SQL live in the service / the shared ClickHouse query builder (`core/db/clickhouse/query`).
- Allowed analytics dimensions are centralized in `core/config/dimensions.config.ts` (`ALLOWED_DIMENSIONS`) — mirror the `GroupByDimension` type on the web.

## Auth & security

- **Better Auth** with Email OTP + the **Dyna SSO** plugin (JWT verified with `SSO_SECRET_KEY`). The JWT carries `role` → `dyna_role` and `scope`, synced onto the `user` row on every login (`sso.plugin.ts`).
- **Data endpoints require a session** → no session = **401**. The real gate is the API.
- Additional profile fields (`dynaRole`, `scope`) are `input: false` in `auth.ts` — set by the SSO plugin only, never client-settable.
- **Never trust client-provided identity/scope** for security decisions (today the role data filter is applied on the web; when hardened it moves here).

## Database (Drizzle + ClickHouse)

- PostgreSQL schema in `core/db/postgres/schema.ts`. Dev sync: **`npm run db:push`** (drizzle-kit). Migrations: `npm run db:generate` / `db:migrate`.
- ClickHouse is read-only analytics, **multi-table** — go through the query builder in `core/db/clickhouse/query`; don't hand-roll SQL in features. Sanitize field/date inputs (`core/utils/sanitization`).
- Filters are dynamic query params parsed by the shared parser (supports arrays and `[neq]`-style operators). Keep the parsing in the shared helpers, not per-route.

## Validation & errors

- Validate inputs with the schema layer (`zod` / Fastify route schemas); return correct HTTP codes and a consistent error shape (see `core/errors`).
- Sanitize any value interpolated into a ClickHouse query.

## Code quality

- **DRY — extract on the 2nd repetition** (a util in `core/utils`, a service method, a shared query helper).
- Strong typing, immutability by default, pure functions where possible. No unused imports or dead code. **Remove `console.log`/debug before finishing.**
- Reuse existing helpers (sanitization, filter parsing, the analytics builder) before writing new ones — search first.

## Verify

- `npx tsc --noEmit` clean before calling a change done.
- `tsx watch` (dev) can miss **new module wiring** in `server.ts` — after registering a new feature/route, restart the API and confirm the route responds (non-404) in the running stack, not just that types pass.
- **Never commit secrets** — only local `api/.env`; commit `.env.example` templates.
