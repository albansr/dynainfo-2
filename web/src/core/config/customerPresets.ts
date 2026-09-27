/**
 * Customer preset lenses for the SELLER client listing (grouped by customer_id).
 * Mirrors the backend `customer-presets.config.ts` ids. 'todos' is the default.
 */
export const CUSTOMER_PRESETS = ['todos', 'riesgo', 'promesa'] as const;

export type CustomerPreset = (typeof CUSTOMER_PRESETS)[number];

export const DEFAULT_CUSTOMER_PRESET: CustomerPreset = 'todos';

/** Options shown in the seller's preset selector (Spanish labels). */
export const CUSTOMER_PRESET_OPTIONS: { id: CustomerPreset; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'riesgo', label: 'En riesgo' },
  { id: 'promesa', label: 'Promesa' },
];

/** Narrow an unknown URL value to a valid preset, defaulting to 'todos'. */
export function toCustomerPreset(value: string | null | undefined): CustomerPreset {
  return CUSTOMER_PRESETS.includes(value as CustomerPreset)
    ? (value as CustomerPreset)
    : DEFAULT_CUSTOMER_PRESET;
}
