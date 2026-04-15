/**
 * Date Range Configuration
 *
 * Defines the available data range for the company.
 * All analytics queries should be constrained within this range.
 */

export const AVAILABLE_DATA_RANGE = {
  min: new Date(2024, 0, 1),
  get max() { return new Date(); },
};

/**
 * Date Range Preset Types
 */
export type DateRangePreset =
  | 'today'            // Hoy (solo el día actual)
  | 'current-month'    // Mes actual (hasta el día de hoy incluido)
  | 'previous-month'   // Mes anterior completo (cerrado)
  | 'accumulated'      // Año en curso (hasta último día del mes cerrado)
  | 'last-30-days'     // Últimos 30 días (hasta el día de hoy incluido)
  | 'last-6-months'    // Últimos 6 meses (hasta el día de hoy incluido)
  | 'last-12-months'   // Últimos 12 meses (hasta el día de hoy incluido)
  | number;            // Año específico (solo años completos cerrados)

/**
 * Human-readable labels for each preset (Spanish)
 */
export const PRESET_LABELS: Record<string, string> = {
  'today': 'Hoy',
  'previous-month': 'Mes anterior',
  'current-month': 'Mes actual',
  'accumulated': 'Acumulado',
  'last-30-days': 'Últimos 30 días',
  'last-6-months': 'Últimos 6 meses',
  'last-12-months': 'Últimos 12 meses',
  'custom': 'Rango personalizado',
};
