export interface BalanceSheetData {
  budget: number;
  budget_last_year: number;
  budget_vs_last_year: number;
  budget_cost: number;
  budget_cost_last_year: number;
  budget_cost_vs_last_year: number;
  sales: number;
  sales_last_year: number;
  sales_vs_last_year: number;
  gross_margin: number;
  gross_margin_last_year: number;
  gross_margin_vs_last_year: number;
  gross_margin_pct: number;
  budget_gross_margin_pct: number;
  orders: number;
  orders_last_year: number;
  orders_vs_last_year: number;
  sales_vs_budget: number;
  budget_achievement_pct: number;
  order_fulfillment_pct: number;
}

export interface BalanceSheetResponse {
  data: BalanceSheetData;
}

export interface BalanceQueryParams {
  startDate?: string;
  endDate?: string;
}
