---
description: Frontend rules for dynainfo-2/web (React 19 + Vite + HeroUI + Tailwind v4)
paths:
  - "web/**/*.tsx"
  - "web/**/*.ts"
  - "web/**/*.css"
---

# Frontend — dynainfo-2/web

React 19 + Vite 7 + React Router 7 (`react-router-dom`) + HeroUI (`@heroui/react`) + Tailwind CSS v4 + TanStack Query + Zustand. Port **4000**. Alias `@/*` → `web/src/*`.

> **Component library: always HeroUI (`@heroui/react`).** It is the one and only UI
> component system for the web app. Do **not** introduce another library (shadcn,
> MUI, Chakra, Mantine, Ant…). Compose from HeroUI primitives; the generic sortable
> table is the shared `@/core/components/RegionalTable`.

> **Use the shared wrappers, not raw primitives where one exists.** Dropdowns go
> through **`@/core/components/AppSelect`** (bakes in the bordered variant, pointer
> cursor and z-50 popover) — never a raw `<Select>` with copy-pasted
> `variant`/`classNames`/`popoverProps`. Page headers go through
> **`@/core/components/PageHeader`** (`chip`, `chipMuted`, `breadcrumbs`,
> `leadingControl`, `titleAccessory`, `subtitle` slots) — don't hand-roll the
> sticky title bar. If a primitive is being styled the same way in a 2nd place,
> wrap it in `@/core` and migrate both.

> **UI language: Spanish.** Every user-facing string is in **Spanish** — labels,
> buttons, table headers, empty/error/loading states, toasts, dialog copy, menu
> items, tooltips. Watch grammatical gender. **Code, identifiers, comments, routes,
> commits and docs stay in English.** Route/URL segments are Spanish here by
> existing convention (`/configuracion`, `/distribucion/detalle`) — match the
> surrounding routes, don't rename them.

> **Product listings lead with CÓDIGO ITEM then REFERENCIA.** Whenever products are
> listed, the first two columns are **CÓDIGO ITEM** (`IdItem`, carried as `code`)
> then **REFERENCIA** (`product_id`, the row `id`). See the RegionalTable columns
> config and the app-wide convention.

## Theme and color

- Design light-first. Do not add a theme toggle or `.dark {}` blocks unless asked.
- Use Tailwind v4 + HeroUI tokens/utilities. Avoid hardcoding hex in components;
  prefer semantic/theme classes and HeroUI `color`/`variant` props.
- Charts share one palette — don't scatter loose colors.

## State management — WHAT TO USE WHEN (hard rule)

Three kinds of state, three tools. **Don't mix them.**

| State type | Tool | Examples | Rule |
|---|---|---|---|
| **Server** (API data) | **TanStack Query** | balance, list, festival, qube6 | ALWAYS `useQuery`/`useMutation`. **NEVER** store server data in Zustand. |
| **Global client** | **Zustand** | session/auth (`auth-storage`), date range (`date-range-storage`) | Client/UI state only, not API responses. |
| **Local UI** | `useState` / `useReducer` | inputs, modal open/closed, selected tab | Don't lift to global if only one component uses it. |

- Server hooks live under `@/core/api/hooks/*` (shared) or `features/{x}/hooks` (feature-specific, e.g. `useFestivalBalance`).
- Real fetch goes through the shared `@/core/api/client` (`apiClient`).
- `queryKey` structured (`['list', groupBy, startDate, endDate, ...]`); mutations invalidate the affected key.
- Fetches send `credentials: 'include'`. On **401** the client treats the user as logged out.
- **No manual `useEffect` + `useState` + `fetch`** for server data — that's what TanStack Query replaces.

## Feature-based architecture

Organize by **feature**; `app/App.tsx` holds thin routes that mount pages.

```
web/src/
├── app/App.tsx           # routes (React Router) — thin
├── core/                 # shared: api (client + hooks), components, config, hooks,
│   │                     #   layouts, router, store, utils
│   ├── components/        # shared UI (RegionalTable, analytics/*, PageHeader…)
│   ├── config/            # access.ts (roles), analysisViews, navigation, drillTarget…
│   └── store/             # zustand stores (authStore, dateRangeStore)
└── features/{name}/       # auth, dashboard, festival, settings…
    ├── pages/            # route pages
    ├── components/       # feature components
    ├── hooks/            # feature hooks
    └── config/           # feature config
```

- Import shared code from `@/core/...` and cross-feature only via a feature's public surface. Don't reach into another feature's internals.
- Truly shared building blocks live in `@/core`, **not** inside a feature (e.g. `RegionalTable`, `DimensionBreakdown`, `AnalyticsListSection`, `breakdownDimensions` are in `@/core`).

## Role-based access (DynaRoles)

- Access is driven by `dyna_role` + `scope` (per-user), resolved in **`@/core/config/access.ts`** (single source of truth): `getRoleDataFilter(dynaRole, scope)`, `getAllowedPresets`, `getAllowedYears`, `canExport`, `resolveActiveView`, `getRoleViewSections`.
- Read the role via `useAuthStore((s) => s.user?.dynaRole)` / `.scope`.
- **Security is frontend-only for now** — the role data filter is applied client-side and is spoofable; treat it as UX gating, not a real boundary (backend enforcement is a later phase).

## Conventions

- **Cursor pointer required** on every clickable element (links, buttons, clickable icons/cards/rows, `onClick`). HeroUI interactive components usually include it; add `cursor-pointer` explicitly otherwise.
- Icons: `@heroicons/react`. **User feedback** with `toast` from `sonner` (Toaster mounted in `App.tsx`). **No `alert()`.**
- **No `console.log`** in code that stays — remove debug logs before a change is done.
- **No `alert`/`confirm`/`prompt`** dialogs.

## Data layer (queries, filters, export)

- **Filters are typed `FilterMap`** (`@/core/api/downloadExcel`), never `Record<string, any>`. It's the single filter shape end-to-end (view config → hooks → export).
- **Serialize filters with `appendFilterParams`** and **merge the role filter with `useMergedFilters`** (both in `@/core/api`). Never re-implement the "array→repeated params" loop or the `dynaRole`/`scope`/`getRoleDataFilter` merge in a hook — that duplication already bit us.
- **Query defaults live in the `QueryClient`** (`app/App.tsx`): `staleTime`, `retry`, `refetchOnWindowFocus: false`, and `placeholderData: keepPreviousData` (so changing view/temporality/page never blanks into a loading flash). Don't copy these per hook; only override when a query genuinely differs (e.g. festival's live `refetchInterval`).
- **On 401 the user is logged out**: `apiClient` calls `clearAuth()` on a 401; `RouteGuard` then redirects to `/login`. The real gate is the API.
- **Excel export goes through `downloadExcel`** (`@/core/api/downloadExcel`) — don't hand-roll the fetch+blob+anchor flow.
- **`useEffect` deps:** effects that validate the session or run once must not depend on `isAuthenticated` (a login would retrigger them). Use stable store actions.

## Accessibility (data surfaces especially)

- **Clickable table rows are real controls:** `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space) + an `aria-label`, not a bare `<tr onClick>`.
- **Sortable headers:** the `<th>` gets `scope="col"` and `aria-sort` (`ascending`/`descending`), and the clickable label is a `<button>` (native keyboard). Group headers get `scope="colgroup"`. Sort glyphs are `aria-hidden`.
- Meaning is never color-only (pair a sign/label/icon with the color).

## State updates

- **Reset derived state during render, not in an effect.** To reset when a prop/identity changes, compare against a `useState` "previous" value and `setState` during render — do not `setState` synchronously inside `useEffect`. This is **lint-enforced as an error** (`react-hooks/set-state-in-effect`), not a warning. The only legit `setState` in an effect is *asynchronous* and synchronising with an external system (a `requestAnimationFrame`/`setTimeout` callback, a subscription handler) — the effect body itself must not call `setState` directly. Modal/panel form seeding on open is a render-time reset (compare a `wasOpen` flag), not an effect.
- **Effects on serialized URL/query state key on the string, not the object.** When a `useMemo`/effect derives from `useSearchParams`, depend on `params.toString()` and rebuild inside (`new URLSearchParams(search)`) — don't list `params` in the deps only to read it inside (stale-closure lint warning) and don't depend on the unstable object identity.

## Code quality

- **DRY — extract on the 2nd repetition** (a hook in `@/core/hooks`, a util in `@/core/utils`, or a component in `@/core/components`).
- Memoize with `useCallback`/`useMemo` when it avoids renders; keep derived objects (filters) stable so children don't re-render. **But don't over-memoize:** a trivial computation (a small `filter`/`map`, a header row of a few cells) or a `useMemo` that closes over functions recreated each render is pure overhead — the React Compiler can't preserve it (`react-hooks/preserve-manual-memoization`) and it adds no value. Memoize for a measured render win or a stable identity a child depends on, not by reflex. No unused imports, variables, or dead code.
- **Import order:** 1) React/ecosystem, 2) third parties, 3) `@/*` alias, 4) relative. Use `@/*` for cross-module, not long relative paths.

## Definition of done (quality bar — keep the score high)

A non-trivial change is done only when ALL hold:

1. **Tests ship with logic.** New/changed policy, hooks, utils, query/serialization or drill logic gets a colocated `*.test.ts(x)` (Vitest). Don't drop the coverage gate (see `testing.md`). Test behavior, not internals.
2. **No `any` in app code.** Filters are `FilterMap`; validate external/URL casts (`?g=`, `?dim=`) instead of `as GroupByDimension`. `catch (e: unknown)` + narrow. The only allowed `any` is a documented flexible generic default with an `eslint-disable-next-line` + reason.
3. **Reuse the shared layer, don't re-implement.** Filters → `appendFilterParams`/`useMergedFilters`; export → `downloadExcel`; table → `RegionalTable`/`AnalyticsListSection`/`DimensionBreakdown`; role policy → `access.ts`. Extract on the 2nd repetition into `@/core`.
4. **Accessible by construction.** Every interactive element is keyboard-operable and labelled: clickable rows/cards → `role`/`tabIndex`/`onKeyDown`/`aria-label` (not bare `onClick` on a `div`/`tr`); sortable `<th>` → `scope` + `aria-sort` + a `<button>`; chart marks → focusable + `aria-label`, never meaning by color alone.
5. **Queries follow the rules.** New data hooks use the `QueryClient` defaults (don't re-declare `staleTime`/`placeholderData`); server state only in TanStack Query; reset derived state during render, not in `useEffect`.
6. **Clean lint + types.** `npx tsc --noEmit -p tsconfig.app.json` and `npx eslint src` with **zero errors and zero warnings** — the baseline is fully clean. Don't silence a rule to a warning to get past it; resolve the underlying pattern (a residual advisory is acceptable only with an inline `eslint-disable-next-line` + a reason, never a project-wide downgrade).
7. **It runs.** Exercise the affected route in the app (`:4000`), not just green checks.

## Verify

- `npx tsc --noEmit -p tsconfig.app.json` clean, `npx eslint src` clean, and `npm test` green before calling a change done.
- **Not done until it runs.** A change is complete only after the affected route loads in the running app (`http://localhost:4000`) — not just when the typecheck passes.
- **A render is not enough for interactive UI.** Actually open menus/popovers/dropdowns/modals and scrollable tables and confirm they aren't clipped and layer correctly.
