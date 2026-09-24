---
description: Testing standards for dynainfo-2 (API Vitest; web suite TBD) — principles first
paths:
  - "api/test/**"
  - "api/**/*.test.ts"
  - "web/**/*.test.ts"
  - "web/**/*.test.tsx"
---

# Testing standards — dynainfo-2

- **API:** Vitest. Tests in **`api/test/**`** mirroring `src/` (`test/features/…`, `test/core/…`, shared `test/helpers`). Run:

```bash
cd api && npm test            # vitest run
cd api && npm run test:coverage
```

- **Web:** **Vitest + Testing Library** (jsdom), tests colocated as `*.test.ts(x)` next to the code, config in `web/vitest.config.ts`, setup in `web/src/test/setup.ts`. Run:

```bash
cd web && npm test
cd web && npm run test:coverage   # gate: 80% stmts/funcs/lines, 70% branches on the covered logic layer
```

Coverage `include` targets the logic layer (policy/config, api client + filter serialization, pure utils) — not thin fetch hooks or UI shells (those are covered by component/E2E tests). Prefer testing behavior: role policy (`access.ts`), the drill chain, filter serialization, the 401→logout path, formatters/date presets.

- **E2E → Playwright** (`web/e2e/`, `npm run e2e`). Needs the stack running (`make up`). Auth is established once in `e2e/auth.setup.ts` via the Dyna SSO test token (`api/generate-test-token.cjs`) hitting the api **directly on :5002** (the web `/api` proxy can't reach the api from inside its container), and reused via `storageState`. Local dev cookies are Lax/insecure (`auth.ts` is env-aware) so the session persists over http.

## Golden rules (this is what matters — above the technology)

1. **ZERO real calls.** No test touches the network, ClickHouse, Postgres, Resend, or Better Auth, or does a real `fetch`. **Always mock external systems.** A test that needs the stack running (except e2e) is badly written.
2. **Blazing fast.** The suite runs in seconds. No `sleep`, real timers, or a real DB.
3. **Deterministic.** Same input → same result. No unpinned `Date.now()` / `Math.random()` / cross-test ordering.
4. **Isolated.** Each test independent; clean up between tests, no shared mutable state.
5. **Test behavior, not implementation.** Assert observable output (HTTP status, body, generated SQL string, computed values), not internals.
6. **Meaningful assertions.** Check the real contract (correct codes, error shape, concrete values) — not just "it didn't throw".

## What to mock vs what not to

| Mock (always) | DON'T mock (it's what you test) |
|---|---|
| ClickHouse / Postgres client, `fetch`/HTTP | Business logic (services, query builders, calculations) |
| Better Auth session, email (Resend) | The SQL you generate (assert the generated string) |
| Clock / randomness | Validation, parsing, pure transformations |

- Prefer **service / unit-integration** tests (several modules together, external deps mocked) over trivial micro-units — more confidence per line.
- Focus coverage where it matters: **service layer, ClickHouse query builder, filter parsing, sanitization, validation**.

## Don't assume a change works

- Not without the relevant `npm test` passing green. Before changing behavior, make sure the covering test exists or is updated.
