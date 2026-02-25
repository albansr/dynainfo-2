export interface RegionalData {
  id: string;
  name: string;
  sales: {
    current: number;
    previous: number;
    variation: number;
  };
  budget: {
    amount: number;
    compliance: number;
  };
  margin: {
    current: number;
    previous: number;
    variation: number;
    budget: number;
  };
  retained: {
    amount: number;
    compliance: number;
  };
}

export interface TableConfig {
  currency: string;
  locale: string;
  currentYear: number;
  previousYear: number;
  thresholds?: HeatmapThresholds;
}

export interface HeatmapThresholds {
  variation: { excellent: number; good: number; neutral: number; warning: number };
  compliance: { excellent: number; good: number; neutral: number; warning: number };
  margin: { excellent: number; good: number; neutral: number };
}

export type SortKey = 'name' | 'sales' | 'budget' | 'margin' | 'marginBudget' | 'retained';
export type SortDirection = 'asc' | 'desc';
