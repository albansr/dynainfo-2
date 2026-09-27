> Living document · 2026-09-27 · DynaInfo 2.0

# Seller client segments — technical design

References: [`prd.md`](prd.md), `.claude/rules/backend.md`, `.claude/rules/frontend.md`,
`.claude/rules/testing.md`.

## Context

The SELLER client listing is the analytics list grouped by `customer_id`, scoped
to the seller via the role data filter (`getRoleDataFilter('SELLER', scope)` →
`seller_id = scope`). It is served by the `list` feature
(`buildGroupedMultiTableYoYQuery`, groupBy `customer_id`) and rendered through the
SELLER default view. We add (a) a **segment lens** — one of four mutually
exclusive segments, "Todos" default, temporality still applied — and (b) two
**client-count metrics** (Numérica, Clientes sin compra) in the seller overview.

## Goals & non-goals

- Goal: SELLER-only, Cliente-only segment selector + two counts, reusing
  Festival's numérica/sin-compra machinery.
- Non-goal: any change for other roles/groupings; Clasificación D (deferred);
  new KPI cards beyond the two counts; multi-select.

## Architecture decision

Model segments as a single optional `segment` request parameter on the existing
list endpoint, dispatched in `list.service` (mirroring how `brand_group` is
dispatched today). Compute the two counts in the seller overview from the existing
distinct-count builders. One listing endpoint; each segment picks "add a filter",
"rank-and-cut", or "compute via exclusion".

Alternatives considered:
- **A dedicated endpoint per segment** — rejected: duplicates the listing contract
  (pagination, mapping, export) three times.
- **Front-only filtering** — impossible for "sin compra" (rows do not exist in the
  grouped result) and for "peso" (needs the full budget distribution).

## Data model

- Customer classification column: **`aionsales_sales_short_customer`** (confirmed
  in ClickHouse; values `Top · Riesgo · Coste · Promesa · Nuevo`; present in both
  `dyna_transactions` and `dyna_budget`). Segment 4 filters
  `aionsales_sales_short_customer IN ('Riesgo', 'Promesa')`.
- Add `aionsales_sales_short_customer` to the allowed filter field list used by
  `filter-builder` (it is filtered server-side).
- No schema migration: existing ClickHouse columns; nothing is written.

## Backend design (`api/src/features/list`)

Segment enum (querystring, `list.schemas.ts`), optional, default `'todos'`:
`'todos' | 'peso' | 'sin_compra' | 'riesgo_promesa'`. Meaning lives in the service.

Config (`api/src/core/config/client-segments.config.ts`, new), mirroring
`brand-groups.config.ts`:
- `riesgo_promesa` → `FilterCondition[]`:
  `aionsales_sales_short_customer IN ['Riesgo', 'Promesa']`.
- Export segment ids/labels for reuse.

Service dispatch (`list.service.ts`, alongside the existing `brand_group` branch,
in `getBalanceList`/`getBalanceListForExport`):
- `todos`: unchanged.
- `riesgo_promesa`: append the classification filter to `currentPeriodFilters`,
  run the normal grouped query (reuse table-aware `filter-builder`; no new path).
  Never drops the `seller_id = scope` filter already present.
- `peso`: run the normal grouped query, then keep the clients that cumulatively
  reach 80% of the seller's budget (ordered by budget desc). Prefer a SQL window
  (`sum(budget) OVER (ORDER BY budget DESC)` / running share) in a new builder
  method so pagination/total stay correct; if too invasive for a first cut,
  compute over the full (capped) result and `log()` the cap.
- `sin_compra`: reuse the Festival pattern but scoped to the **seller's own
  buyers**. Festival's `getFestivalSinCompraList` (route `GET /festival/sin-compra`)
  is built on `buildDistinctCountExcludingQuery` (grouped-by-dimension variant,
  `analytics-query-builder.ts` ~line 1323). Add a list-service method
  `getSinCompraClientList(filters)` returning the seller's historical invoiced
  buyers **excluding** those who bought in the current window, ordered by
  facturación, mapped to `ListItemResponse`. Universe = clients with a prior
  invoiced purchase from this seller (the `seller_id = scope` filter defines
  "this seller"); do NOT use `activeCustomerUniverseFilters` here — the seller
  perspective is buyer history, not the customer master (PRD decision).

Route (`list.routes.ts`): read `segment`, pass it through; the seller filter stays
in `allFilters`.

### Two count metrics (Numérica, Sin compra)

Independent of the selected segment. Computed for the seller + window:
- **Numérica** = `buildDistinctCountQuery` for `customer_id` over the current
  window (Festival's `clientes_unicos`, scoped by the seller filter).
- **Clientes sin compra** = `buildDistinctCountExcludingQuery`: seller's prior
  invoiced buyers minus current-window buyers (the count behind segment 3).

Expose them where the seller overview cards get their data. Reuse the existing
distinct-count builders — do not hand-roll counts. Options (pick in
implementation): extend the balance/overview payload for SELLER, or a small
`GET /list/seller-counts` returning `{ numerica, sinCompra }`. Keep them
role-gated so only SELLER pays the extra queries.

Reuse, do not re-implement: `filter-builder`, `buildDistinctCountQuery`,
`buildDistinctCountExcludingQuery`, `toListItemResponse`, `buildDynamicResponse`.

## Frontend design (`web/src/…`)

1. **Segment catalog** (`web/src/core/config/clientSegments.ts`, new):
   `CLIENT_SEGMENTS: { id: SegmentId; label: string }[]` — `Todos`,
   `Con peso en su cumplimiento`, `Sin compra`, `Riesgo y promesa`. `id` matches
   the backend enum.
2. **Gating**: show the selector and the two counts only when
   `dynaRole === 'SELLER'` (read via `useAuthStore((s) => s.user?.dynaRole)`) and
   the active grouping is `customer_id`. Centralise the role check (one helper),
   per frontend DRY rules.
3. **Selector UI**: an `AppSelect` (shared wrapper — never a raw `Select`) labelled
   "Segmento" above the client table, default `Todos`, mirroring the Festival
   listing selector for look/behaviour. Cursor-pointer, Spanish copy.
4. **Counts UI**: two metric cards ("Numérica", "Clientes sin compra") in the
   seller overview, reusing the existing metric-card component used by
   `DashboardView`. They reflect the window, not the segment.
5. **State & query**: segment is **URL state** (`?seg=`), read via `useSearchParams`
   keyed on `params.toString()` (frontend state rules). Thread it into the list
   query hook (`useList` / analytics list hook) as `segment`, in the `queryKey` so
   TanStack refetches on change. Filters still go through
   `appendFilterParams`/`useMergedFilters`; the role-filter merge is unchanged. The
   counts are their own query hook (role-gated), also keyed on the window.
6. **Wiring point**: the SELLER listing is the analytics list under
   `analysisViews.ts` `SELLER_DEFAULT_VIEW` (groupBy `customer_id`), rendered via
   `DashboardView` + the client table (`AnalyticsListSection`/`DimensionBreakdown`).
   Add the selector and the two cards in that render path, guarded by (2).

## Screens (UX)

- **Selector**: single dropdown "Segmento" above the table, default "Todos", one
  at a time.
- **Counts**: two cards above the table ("Numérica", "Clientes sin compra"),
  always reflecting the window; they do not change when the segment changes.
- **Empty state**: a segment with no clients shows the standard Spanish empty
  message (e.g. "Sin clientes en este segmento").
- **Loading**: reuse `placeholderData: keepPreviousData` so switching segments
  never blanks into a spinner.
- **Sin compra specifics**: the "Sin compra" table is facturación-ordered;
  current-period sales are zero by definition, so surface last-year / facturación
  columns and do not imply a current sale.
- **Row click/drill**: unchanged from the current client listing.
- **Guarded state**: selector and cards are simply absent for non-SELLER or
  non-Cliente contexts (no disabled control).

## Authorization & security

- No segment or count ever replaces the `seller_id = scope` role filter; every
  query includes it. Security is frontend-only today (`CLAUDE.md`); this feature
  keeps that contract and adds no bypass. `segment` is a fixed enum validated by
  the route schema; classification values are sanitized like any filter.

## Testing strategy (Vitest, external systems mocked)

- **`client-segments.config` unit**: `riesgo_promesa` yields the expected
  classification `FilterCondition[]`.
- **`list.service` behaviour** (mock `IAnalyticsQueryBuilder`, per existing
  `list.service.test.ts`):
  - `segment=riesgo_promesa` calls the grouped query with the classification filter
    appended and keeps the `seller_id` filter.
  - `segment=peso` applies the 80% cumulative cut deterministically over a mocked
    budget distribution.
  - `segment=sin_compra` uses the exclusion path (assert the exclusion query is
    called with the seller's historical universe + current filters), not the plain
    grouped query.
  - `segment=todos` is identical to today.
  - The two counts call `buildDistinctCountQuery` / `buildDistinctCountExcludingQuery`
    with the seller filter.
- **Web**: unit-test the gating (selector + cards only for SELLER + `customer_id`)
  and that `segment` is threaded into the query key / request.
- No test hits ClickHouse; assert generated filters/args and mapped output only.

## Rollout plan

1. Land backend `segment` handling + the two counts behind the SELLER gate
   (default `todos` = no change to today's listing).
2. Add the front selector and cards, gated to SELLER + Cliente.
3. Validate the open definitions on the preview: the classification column/values
   (PRD-1) and that Numérica / Sin compra match the Festival-style counts for the
   same seller/window.
4. No feature flag: invisible until a SELLER loads the Cliente listing.

## Glossary

- **Segmento**: one of the four client lenses; mutually exclusive, "Todos" default.
- **Numérica**: count of the seller's clients with a purchase in the window.
- **Sin compra**: the seller's prior buyers (bought from this seller before) with
  no purchase in the window; shown as a count above and as a listing segment.
- **Peso en cumplimiento**: clients that cumulatively make up 80% of the seller's
  budget.
- **Riesgo / Promesa**: values ('Riesgo', 'Promesa') of the customer
  `aionsales_sales_short_customer` classification column.
