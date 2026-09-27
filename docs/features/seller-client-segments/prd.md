> Living document · 2026-09-27 · DynaInfo 2.0

# Seller client segments

## Summary

Give the Vendedor (SELLER) role a segment selector over their client listing plus
two client-count metrics above it, so a seller can focus on the commercially
meaningful subsets of their own clients (top clients, clients with no recent
purchase, risk/promise clients) without leaving the "Cliente" grouping.

## Problem

A seller today only sees a flat list of their clients (grouped by `customer_id`,
scoped to their `seller_id`). The commercially actionable questions —"who did I
lose this month?", "which clients carry my budget?", "who is at risk?"— require
manual filtering the app does not offer. The "clientes sin compra" answer in
particular cannot be reconstructed at all, because a client with no purchase in
the period simply does not appear in the listing, and the seller has no at-a-glance
count of how many clients bought vs. went silent.

## Goal

Let a seller switch their client listing between a small set of predefined
segments (with "Todos" as the default), and see two headline counts —clients with
a purchase (numérica) and clients with no purchase— above the table, reusing the
proven Festival Virtual "clientes sin compra" mechanism.

## User

The **Vendedor (SELLER)** role only. Everything in this feature — the selector and
the two counts — is shown to SELLER and no other role. A seller is scoped to their
own clients via `scope` = `seller_id` (see `access.ts` `getRoleDataFilter`).

## What it lets you do

Pick one segment at a time for the client listing. Segments (mutually exclusive,
"Todos" default; temporality keeps applying on top):

1. **Todos** (default) — every client of the seller, current behaviour.
2. **Clientes con peso en su cumplimiento** — the clients that cumulatively make
   up 80% of the seller's budget (ordered by budget desc; the ones whose
   compliance moves the needle).
3. **Clientes sin compra** — from the seller's own perspective: clients who have
   bought **from this seller** at least once but did **not** buy in the selected
   temporality window. Ordered by facturación.
4. **Clientes riesgo y clientes promesa** — clients whose customer classification
   marks them "en riesgo" or "promesa".

Above the table, two count metrics (cards), scoped to the seller and the selected
window:

- **Numérica** — number of the seller's clients with a purchase in the period.
- **Clientes sin compra** — number of the seller's prior buyers with no purchase
  in the period (the count behind segment 3).

## Model (in simple terms)

- Segment 4 is a **plain filter** over a categorical customer column already in
  `dyna_transactions` (the `aionsales_value_short_customer*` family — the
  customer-side analogue of the product `aionsales_value_short_product`).
- Segment 3 and the "Clientes sin compra" count are **computed**, not filters:
  the seller's historical buyers minus the clients who bought in the period — the
  same definition Festival Virtual implements (`clientes_sin_compra`), but the
  universe is scoped to this seller's own buyers.
- Segment 2 is a **ranking cut**: order the seller's clients by budget and keep
  those that cumulatively reach 80%.
- "Numérica" is a **distinct count** of the seller's clients with a purchase in
  the period (Festival's `clientes_unicos`, scoped to the seller).

## Guiding principles

- Reuse Festival Virtual's numérica / sin-compra machinery; do not invent a second
  one.
- Segments are a presentation lens over the existing SELLER client listing, plus
  two counts above it — not a new page.
- Wrong commercial definitions are worse than a missing segment: anything
  ambiguous ships behind an explicit "decision to validate".

## Out of scope

- Any change for roles other than SELLER, or groupings other than "Cliente".
- **Clientes con clasificación D** — deferred for now (was requested, then paused).
- New KPI cards beyond the two client counts (Numérica, Sin compra).
- Multi-select of segments; exactly one segment is active at a time.

## Success metrics

- A seller reaches each of the four segments in one click from the client listing.
- The "Numérica" and "Clientes sin compra" counts, and segment 3's rows, match the
  Festival-style definition (seller's historical buyers vs period buyers) for the
  same seller and window.
- No other role sees any change.

## Acceptance criteria

- The segment selector and the two counts appear **only** for SELLER and **only**
  when grouping by Cliente; "Todos" is preselected.
- Selecting a segment updates the client table to that subset while keeping the
  active temporality; switching is immediate and mutually exclusive.
- "Clientes sin compra" (segment and count) uses the seller's own buyers: clients
  with a prior purchase **from this seller** and none in the selected window; it
  never shows/counts a client that bought in the window.
- "Numérica" counts the seller's clients with a purchase in the window.
- "Riesgo/Promesa" lists exactly the clients whose classification column holds the
  risk/promise values.
- "Peso en su cumplimiento" lists the clients that cumulatively make up 80% of the
  seller's budget, ordered by budget desc.
- Security: a seller only ever sees/counts their own clients in every segment and
  both metrics (the `seller_id = scope` filter is never bypassed).

## Decisions resolved

- **Risk/Promise column and values (was to-validate).** Confirmed against
  ClickHouse: the field is **`aionsales_sales_short_customer`** (the "aionsales
  ventas" customer analysis), whose values are `Top · Riesgo · Coste · Promesa ·
  Nuevo`. Segment 4 = `aionsales_sales_short_customer IN ('Riesgo', 'Promesa')`.
  The column exists in both `dyna_transactions` and `dyna_budget`.

## Decisions still to validate

1. **Metrics vs listing coupling.** Confirm the two counts sit in the seller
   overview cards above the table and are **independent of the selected segment**
   (they always reflect Numérica and Sin compra for the window), while the table
   reflects the chosen segment.
