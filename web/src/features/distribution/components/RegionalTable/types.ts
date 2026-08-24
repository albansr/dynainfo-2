export interface RegionalData {
  id: string;
  name: string;
  /** Optional secondary code shown next to the name (festival product listing: IdItem). */
  code?: string;
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
    /** Optional extra numeric slot (used by the festival listing). */
    variation?: number;
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

export type SortKey = 'name' | 'code' | 'reference' | 'sales' | 'budget' | 'margin' | 'marginBudget' | 'retained' | 'comprometido' | 'avgOrder' | 'ppto' | 'pptoCumpl' | 'numerica' | 'items' | 'sinCompra';
export type SortDirection = 'asc' | 'desc';
