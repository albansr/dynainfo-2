import type { FilterCondition } from '../db/clickhouse/query/filter-builder.js';

/**
 * Customer preset lenses for the SELLER client listing (grouped by customer_id).
 * Each preset reshapes the seller's own clients; 'todos' is the default and
 * applies no extra filter. Risk and Promise are two distinct lenses over the
 * customer sales-analysis classification. 'peso' is a ranking cut (the clients
 * that concentrate the bulk of the budget) and is resolved in the list service,
 * not as a filter.
 *
 * Two "no purchase in the window" lenses, both limited to ACTIVE customers of
 * the master and resolved in the list service via exclusion:
 * - 'sin_compra_mes': the seller's assigned active customers (the master, like
 *   Festival) — Estado's "sin compra este mes".
 * - 'sin_compra': the seller's historical buyers who are still active — Estado's
 *   "se enfriaron".
 */
export const CUSTOMER_PRESETS = ['todos', 'riesgo', 'promesa', 'peso', 'sin_compra', 'sin_compra_mes'] as const;

export type CustomerPreset = (typeof CUSTOMER_PRESETS)[number];

export const DEFAULT_CUSTOMER_PRESET: CustomerPreset = 'todos';

/**
 * Share of total sales the "peso" preset accumulates (Pareto cut). Budget has no
 * per-customer breakdown in the data (it is a seller-level figure), so the clients
 * that carry the seller's compliance are ranked by their sales, not their budget.
 */
export const PESO_SALES_SHARE = 0.8;

/**
 * Customer sales-analysis column that classifies each client
 * (confirmed values: Top · Riesgo · Coste · Promesa · Nuevo).
 */
const CUSTOMER_SALES_CLASS = 'aionsales_sales_short_customer';

/**
 * Extra filters a preset appends to the seller's client listing. The seller's
 * own `seller_id = scope` filter is applied separately and is never removed.
 * The classification lives on the sales rows only: scoping it there picks the
 * clients, and their pending orders still join by customer in the listing.
 */
export function customerPresetFilters(preset: CustomerPreset): FilterCondition[] {
  switch (preset) {
    case 'riesgo':
      return [{ field: CUSTOMER_SALES_CLASS, operator: 'eq', value: 'Riesgo', table: 'transactions' }];
    case 'promesa':
      return [{ field: CUSTOMER_SALES_CLASS, operator: 'eq', value: 'Promesa', table: 'transactions' }];
    case 'todos':
    default:
      return [];
  }
}
