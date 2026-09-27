import type { FilterCondition } from '../db/clickhouse/query/filter-builder.js';

/**
 * Customer preset lenses for the SELLER client listing (grouped by customer_id).
 * Each preset reshapes the seller's own clients; 'todos' is the default and
 * applies no extra filter. Risk and Promise are two distinct lenses over the
 * customer sales-analysis classification.
 *
 * (peso / sin_compra are planned follow-ups — see the feature TDD.)
 */
export const CUSTOMER_PRESETS = ['todos', 'riesgo', 'promesa'] as const;

export type CustomerPreset = (typeof CUSTOMER_PRESETS)[number];

export const DEFAULT_CUSTOMER_PRESET: CustomerPreset = 'todos';

/**
 * Customer sales-analysis column that classifies each client
 * (confirmed values: Top · Riesgo · Coste · Promesa · Nuevo).
 */
const CUSTOMER_SALES_CLASS = 'aionsales_sales_short_customer';

/**
 * Extra filters a preset appends to the seller's client listing. The seller's
 * own `seller_id = scope` filter is applied separately and is never removed.
 */
export function customerPresetFilters(preset: CustomerPreset): FilterCondition[] {
  switch (preset) {
    case 'riesgo':
      return [{ field: CUSTOMER_SALES_CLASS, operator: 'eq', value: 'Riesgo' }];
    case 'promesa':
      return [{ field: CUSTOMER_SALES_CLASS, operator: 'eq', value: 'Promesa' }];
    case 'todos':
    default:
      return [];
  }
}
