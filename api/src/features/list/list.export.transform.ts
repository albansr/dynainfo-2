import type { ListItemResponse } from './list.schemas.js';

/**
 * Server-side port of the frontend RegionalData shape
 * (`web/src/features/distribution/components/RegionalTable/types.ts`).
 * One export row = one grouped dimension value with its resolved sub-values.
 */
export interface ExportRow {
  id: string;
  name: string;
  sales: { current: number; previous: number; variation: number };
  budget: { amount: number; compliance: number };
  margin: { current: number; previous: number; variation: number; budget: number };
  retained: { amount: number; compliance: number };
}

/**
 * Port of `usesFacturadoOnly` (web/src/core/utils/salesMetric.ts):
 * closed past periods use facturado-only sales instead of facturado + comprometido.
 */
export function usesFacturadoOnly(preset: string | undefined): boolean {
  return preset === 'previous-month' || preset === 'accumulated';
}

/** Safe numeric read from a loosely-typed ListItemResponse field. */
function num(item: ListItemResponse, key: string): number {
  const value = (item as unknown as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : 0;
}

/** Safe string read from a loosely-typed ListItemResponse field. */
function str(item: ListItemResponse, key: string): string {
  const value = (item as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Port of `mapApiToRegionalData` + nameOverrides remap (AnalyticsPage.tsx:141-177).
 * Picks `sales` vs `sales_total` based on the preset, exactly like `getSalesMetric`.
 */
export function mapListItemToExportRow(
  item: ListItemResponse,
  preset: string | undefined,
  nameOverrides?: Record<string, string>
): ExportRow {
  const facturadoOnly = usesFacturadoOnly(preset);
  const salesCurrent = facturadoOnly ? num(item, 'sales') : num(item, 'sales_total');
  const salesPrevious = facturadoOnly ? num(item, 'sales_last_year') : num(item, 'sales_total_last_year');
  const salesVariation = facturadoOnly ? num(item, 'sales_vs_last_year') : num(item, 'sales_total_vs_last_year');

  const rawName = str(item, 'name');
  const name = nameOverrides && rawName in nameOverrides ? nameOverrides[rawName]! : rawName;

  return {
    id: str(item, 'id'),
    name,
    sales: {
      current: salesCurrent,
      previous: salesPrevious,
      variation: salesVariation,
    },
    budget: {
      amount: num(item, 'budget'),
      compliance: num(item, 'budget_achievement_pct'),
    },
    margin: {
      current: num(item, 'gross_margin_pct'),
      previous: num(item, 'gross_margin_pct_last_year'),
      variation: num(item, 'gross_margin_pct_vs_last_year'),
      budget: num(item, 'budget_gross_margin_pct'),
    },
    retained: {
      amount: num(item, 'cartera'),
      compliance: num(item, 'cartera_compliance_pct'),
    },
  };
}

/**
 * Port of `calculateTotals` (AnalyticsPage.tsx:20-94), formula-for-formula.
 * SUM for amounts, sales-weighted AVERAGE for margins, recomputed ratios for
 * compliance — so the TOTAL row matches what a user would reconstruct in Excel.
 */
export function calculateExportTotals(rows: ExportRow[], totalsLabel: string): ExportRow {
  const totals = rows.reduce(
    (acc, item) => ({
      salesCurrent: acc.salesCurrent + item.sales.current,
      salesPrevious: acc.salesPrevious + item.sales.previous,
      budgetAmount: acc.budgetAmount + item.budget.amount,
      budgetMargin: acc.budgetMargin + (item.margin.budget * item.budget.amount) / 100,
      retainedAmount: acc.retainedAmount + item.retained.amount,
    }),
    { salesCurrent: 0, salesPrevious: 0, budgetAmount: 0, budgetMargin: 0, retainedAmount: 0 }
  );

  const salesVariation =
    totals.salesPrevious !== 0
      ? ((totals.salesCurrent - totals.salesPrevious) / totals.salesPrevious) * 100
      : 0;

  const budgetCompliance =
    totals.budgetAmount !== 0 ? (totals.salesCurrent / totals.budgetAmount) * 100 : 0;

  const marginCurrent =
    totals.salesCurrent !== 0
      ? rows.reduce((acc, item) => acc + (item.margin.current * item.sales.current), 0) /
        totals.salesCurrent
      : 0;

  const marginPrevious =
    totals.salesPrevious !== 0
      ? rows.reduce((acc, item) => acc + ((item.margin.previous ?? 0) * item.sales.previous), 0) /
        totals.salesPrevious
      : 0;

  const marginBudget = totals.budgetAmount !== 0 ? totals.budgetMargin / totals.budgetAmount : 0;

  // Variación en puntos porcentuales (20% → 25% = +5), no crecimiento relativo.
  const marginVariation = totals.salesPrevious !== 0 ? marginCurrent - marginPrevious : 0;

  const retainedCompliance =
    totals.budgetAmount !== 0 ? (totals.retainedAmount / totals.budgetAmount) * 100 : 0;

  return {
    id: 'totals',
    name: totalsLabel,
    sales: { current: totals.salesCurrent, previous: totals.salesPrevious, variation: salesVariation },
    budget: { amount: totals.budgetAmount, compliance: budgetCompliance },
    margin: { current: marginCurrent, previous: marginPrevious, variation: marginVariation, budget: marginBudget },
    retained: { amount: totals.retainedAmount, compliance: retainedCompliance },
  };
}
