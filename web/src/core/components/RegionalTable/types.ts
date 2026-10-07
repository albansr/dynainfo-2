export interface RegionalData {
  id: string;
  name: string;
  /** Optional secondary code shown next to the name (festival product listing: IdItem). */
  code?: string;
  /** Optional 1-based ranking by billing (seller customer-preset listings). */
  rank?: number;
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
  /** Units sold and average cost per unit (product listings only). */
  units?: {
    current: number;
    avgCost: number;
    /** Comparison period (last year); absent when the listing has no comparison. */
    previous?: number;
    avgCostPrevious?: number;
    /** Average selling price per unit (sales / units). */
    avgPrice?: number;
    avgPricePrevious?: number;
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

export type SortKey = 'name' | 'code' | 'reference' | 'sales' | 'budget' | 'margin' | 'marginBudget' | 'retained' | 'comprometido' | 'avgOrder' | 'ppto' | 'pptoCumpl' | 'numerica' | 'items' | 'sinCompra' | 'units' | 'avgUnitPrice' | 'avgUnitCost';
export type SortDirection = 'asc' | 'desc';
