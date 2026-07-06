/**
 * Server-side port of the table heatmap text colors
 * (web/src/features/distribution/components/RegionalTable/utils/heatmap.ts
 * + constants.ts + the inline branch logic in cellRenderers.tsx).
 *
 * Colors are returned as 6-digit hex WITHOUT the leading '#', ready to be
 * turned into ExcelJS ARGB by prefixing 'FF'.
 */

const HEAT_TEXT = {
  excellent: '15803D',
  good: '16A34A',
  neutral: '64748B',
  warning: 'B45309',
  low: 'DC2626',
} as const;

const THRESHOLDS = {
  variation: { excellent: 20, good: 5, neutral: 0, warning: -5 },
  compliance: { excellent: 105, good: 99, neutral: 95, warning: 80 },
};

/** Convert a 6-digit hex (no '#') to ExcelJS ARGB (opaque). */
export function toArgb(hex6: string): string {
  return `FF${hex6}`;
}

/** Port of getVariationColor — used for the sales YoY variation column. */
export function variationColor(variation: number): string {
  if (!Number.isFinite(variation)) return HEAT_TEXT.neutral;
  if (variation >= THRESHOLDS.variation.excellent) return HEAT_TEXT.excellent;
  if (variation >= THRESHOLDS.variation.good) return HEAT_TEXT.good;
  if (variation >= THRESHOLDS.variation.neutral) return HEAT_TEXT.neutral;
  if (variation >= THRESHOLDS.variation.warning) return HEAT_TEXT.warning;
  return HEAT_TEXT.low;
}

/** Port of getComplianceColor — used for budget/retained compliance columns. */
export function complianceColor(compliance: number): string {
  if (compliance >= THRESHOLDS.compliance.excellent) return HEAT_TEXT.excellent;
  if (compliance >= THRESHOLDS.compliance.good) return HEAT_TEXT.good;
  if (compliance >= THRESHOLDS.compliance.neutral) return HEAT_TEXT.neutral;
  if (compliance >= THRESHOLDS.compliance.warning) return HEAT_TEXT.warning;
  return HEAT_TEXT.low;
}

/**
 * Port of marginCellRenderer's color logic: current margin colored by its
 * YoY variation (cellRenderers.tsx:66-72).
 */
export function marginCurrentColor(variation: number): string {
  if (!Number.isFinite(variation)) return HEAT_TEXT.neutral;
  if (variation > 2) return HEAT_TEXT.excellent;
  if (variation > 0) return HEAT_TEXT.good;
  if (variation >= -2) return HEAT_TEXT.neutral;
  return HEAT_TEXT.low;
}

/** Port of marginCellRenderer's delta color (cellRenderers.tsx:74). */
export function marginVariationColor(variation: number): string {
  if (!Number.isFinite(variation)) return HEAT_TEXT.neutral;
  if (variation > 0) return HEAT_TEXT.excellent;
  if (variation < 0) return HEAT_TEXT.low;
  return HEAT_TEXT.neutral;
}

/**
 * Port of marginBudgetCellRenderer's color logic: colored by delta =
 * budget - real (cellRenderers.tsx:107-114). Red when budget above real (bad),
 * green when real above budget (good).
 */
export function marginBudgetColor(delta: number): string {
  if (delta >= 0.5) return HEAT_TEXT.low;
  if (delta >= -0.5) return HEAT_TEXT.neutral;
  if (delta >= -2) return HEAT_TEXT.good;
  return HEAT_TEXT.excellent;
}
