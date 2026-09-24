import type { HeatmapThresholds } from '../types';

export interface HeatmapColor {
  bg: string;
  text: string;
}

export const HEAT_COLORS = {
  excellent: { bg: 'rgba(22,163,74,0.14)', text: '#15803d' },
  good: { bg: 'rgba(22,163,74,0.05)', text: '#16a34a' },
  neutral: { bg: 'transparent', text: '#64748b' },
  warning: { bg: 'rgba(217,119,6,0.06)', text: '#b45309' },
  low: { bg: 'rgba(220,38,38,0.07)', text: '#dc2626' },
} as const;

export function getVariationColor(variation: number, thresholds: HeatmapThresholds): HeatmapColor {
  if (variation >= thresholds.variation.excellent) return HEAT_COLORS.excellent;
  if (variation >= thresholds.variation.good) return HEAT_COLORS.good;
  if (variation >= thresholds.variation.neutral) return HEAT_COLORS.neutral;
  if (variation >= thresholds.variation.warning) return HEAT_COLORS.warning;
  return HEAT_COLORS.low;
}

export function getComplianceColor(compliance: number, thresholds: HeatmapThresholds): HeatmapColor {
  if (compliance >= thresholds.compliance.excellent) return HEAT_COLORS.excellent;
  if (compliance >= thresholds.compliance.good) return HEAT_COLORS.good;
  if (compliance >= thresholds.compliance.neutral) return HEAT_COLORS.neutral;
  if (compliance >= thresholds.compliance.warning) return HEAT_COLORS.warning;
  return HEAT_COLORS.low;
}

export function getMarginColor(margin: number, thresholds: HeatmapThresholds): HeatmapColor {
  if (margin >= thresholds.margin.excellent) return HEAT_COLORS.excellent;
  if (margin >= thresholds.margin.good) return HEAT_COLORS.good;
  if (margin >= thresholds.margin.neutral) return HEAT_COLORS.neutral;
  return HEAT_COLORS.warning;
}
