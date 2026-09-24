import { getComplianceColor } from '../utils/heatmap';
import type { BackgroundColorFn } from './types';

export const budgetBackgroundColor: BackgroundColorFn = (data, config) => {
  // No background color if no budget
  if (data.budget.amount === 0) {
    return 'transparent';
  }
  const thresholds = config.thresholds!;
  return getComplianceColor(data.budget.compliance, thresholds).bg;
};

export const marginBackgroundColor: BackgroundColorFn = (data, _config) => {
  const variation = data.margin.variation;
  if (variation > 2) return 'rgba(22,163,74,0.14)'; // Verde fuerte si subió más de 2%
  if (variation > 0) return 'rgba(22,163,74,0.05)'; // Verde suave si subió
  if (variation >= -2) return 'transparent'; // Neutral si varió poco
  return 'rgba(220,38,38,0.07)'; // Rojo si bajó más de 2%
};

export const marginBudgetBackgroundColor: BackgroundColorFn = (data, _config) => {
  // No background color if no budget
  if (data.margin.budget === 0) {
    return 'transparent';
  }
  const delta = data.margin.budget - data.margin.current;
  if (delta >= 2) return 'rgba(220,38,38,0.07)'; // Red if budget much higher (bad)
  if (delta >= 0.5) return 'rgba(220,38,38,0.07)'; // Red soft
  if (delta >= -0.5) return 'transparent';
  if (delta >= -2) return 'rgba(22,163,74,0.05)'; // Green soft if real higher (good)
  return 'rgba(22,163,74,0.14)'; // Green strong
};

export const retainedBackgroundColor: BackgroundColorFn = (data, config) => {
  const thresholds = config.thresholds!;
  return getComplianceColor(data.retained.compliance, thresholds).bg;
};
