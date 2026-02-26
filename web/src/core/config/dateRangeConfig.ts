/**
 * Date Range Configuration
 *
 * Defines the available data range for the company.
 * All analytics queries should be constrained within this range.
 */

export const AVAILABLE_DATA_RANGE = {
  min: new Date('2024-01-01'),
  max: new Date('2026-01-08'),
} as const;

/**
 * Date Range Preset Types
 */
export type DateRangePreset =
  | 'today'            // Hoy (solo el día actual)
  | 'current-month'    // Mes actual (hasta día anterior cerrado)
  | 'accumulated'      // Año en curso hasta día anterior cerrado
  | 'last-30-days'     // Últimos 30 días (día anterior cerrado)
  | 'last-6-months'    // Últimos 6 meses (día anterior cerrado)
  | 'last-12-months'   // Últimos 12 meses (día anterior cerrado)
  | number;            // Año específico (solo años completos cerrados)
