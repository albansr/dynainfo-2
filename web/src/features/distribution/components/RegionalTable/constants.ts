import type { HeatmapThresholds } from './types';

export const DEFAULT_THRESHOLDS: HeatmapThresholds = {
  variation: { excellent: 20, good: 5, neutral: 0, warning: -5 },
  compliance: { excellent: 105, good: 99, neutral: 95, warning: 80 },
  margin: { excellent: 24.5, good: 23, neutral: 21.5 },
};
