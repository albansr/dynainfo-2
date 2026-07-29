import type { ReactNode } from 'react';
import type { RegionalData, TableConfig } from '@/features/distribution/components/RegionalTable';
import type { ColumnDefinition } from '@/features/distribution/components/RegionalTable/config/types';
import { formatCurrency, formatPercentage } from '@/core/utils/formatters';
import type { FestivalListRow } from '../hooks/useFestivalBalance';

/**
 * Map festival listing rows onto the shared `RegionalData` shape so they render
 * with the same `RegionalTable` used across the app. `RegionalData` has no
 * festival fields, so numeric slots are reused; the columns below read exactly
 * these slots:
 *   sales.current   → ventas (facturado + comprometido)
 *   sales.previous  → % de ventas sobre el total del listado
 *   margin.current  → margen bruto %
 *   budget.compliance   → margen recuperado (rappel) %
 *   retained.compliance → margen total (margen + rappel) %
 *   budget.amount   → comprometido (valor de pedidos pendientes de facturar)
 *   retained.amount → pedido promedio
 *   margin.budget   → presupuesto del festival ($)
 *   margin.previous → cumplimiento de presupuesto (%)
 * `% sobre total` is computed here over the sum of the current listing.
 */
export function festivalRowsToRegionalData(rows: FestivalListRow[]): RegionalData[] {
  const total = rows.reduce((sum, r) => sum + r.sales_total, 0);
  return rows.map((row, index) => ({
    id: row.id || `row-${index}`, // fall back keeps React keys unique
    name: row.name,
    sales: { current: row.sales_total, previous: total > 0 ? (row.sales_total / total) * 100 : 0, variation: NaN },
    margin: { current: row.gross_margin_pct, previous: row.cumplimiento_ppto ?? 0, variation: NaN, budget: row.presupuesto ?? 0 },
    budget: { amount: row.comprometido, compliance: row.rappel_pct },
    retained: { amount: row.pedido_promedio, compliance: row.margen_rappel_pct },
  }));
}

const currencyCell = (_d: RegionalData, _c: TableConfig, value: number): ReactNode => (
  <div className="px-4 text-right py-2.5 text-[13px] text-zinc-900">
    <span className="text-[11px] text-zinc-500">$</span>{' '}
    <span className="font-semibold">{formatCurrency(value)}</span>
  </div>
);

const percentCell = (_d: RegionalData, _c: TableConfig, value: number): ReactNode => (
  <div className="px-4 text-right py-2.5 text-[13px] font-semibold text-zinc-900">
    {formatPercentage(value)}%
  </div>
);

const textCell = (_d: RegionalData, _c: TableConfig, value: string): ReactNode => (
  <div className="px-4 text-left py-2.5 text-[12px] font-medium text-zinc-900">{value}</div>
);

/** Budget compliance: green from 100% up, red below; dash without budget. */
const complianceCell = (d: RegionalData, _c: TableConfig, value: number): ReactNode =>
  d.margin.budget > 0 ? (
    <div
      className={`px-4 text-right py-2.5 text-[13px] font-semibold ${value >= 100 ? 'text-green-600' : 'text-red-600'}`}
    >
      {formatPercentage(value)}%
    </div>
  ) : (
    <div className="px-4 text-right py-2.5 text-[13px] text-zinc-400">—</div>
  );

/**
 * Festival listing columns. Flat (no groups), so every header spans both header
 * rows (rowSpan: 2) — a plain column with no group and no rowSpan would not be
 * rendered by TableHeader. Labels mirror the header cards.
 */
export const FESTIVAL_COLUMNS: ColumnDefinition[] = [
  {
    id: 'name',
    header: { label: 'PROVEEDOR', sortable: true, align: 'left', rowSpan: 2 },
    accessor: (d) => d.name,
    cellRenderer: textCell,
    align: 'left',
    sortable: true,
    sortKey: 'name',
  },
  {
    id: 'share',
    header: { label: '% VENTAS', sortable: true, align: 'right', rowSpan: 2 },
    accessor: (d) => d.sales.previous,
    cellRenderer: percentCell,
    align: 'right',
    sortable: true,
    sortKey: 'marginBudget',
  },
  {
    id: 'sales',
    header: { label: 'VENTAS (FACTURADO + COMPROMETIDO)', sortable: true, align: 'right', rowSpan: 2 },
    accessor: (d) => d.sales.current,
    cellRenderer: currencyCell,
    align: 'right',
    sortable: true,
    sortKey: 'sales',
  },
  {
    id: 'comprometido',
    header: { label: 'COMPROMETIDO', sortable: true, align: 'right', rowSpan: 2 },
    accessor: (d) => d.budget.amount,
    cellRenderer: currencyCell,
    align: 'right',
    sortable: true,
    sortKey: 'comprometido',
  },
  {
    id: 'margin',
    header: { label: 'MARGEN BRUTO', sortable: true, align: 'right', rowSpan: 2 },
    accessor: (d) => d.margin.current,
    cellRenderer: percentCell,
    align: 'right',
    sortable: true,
    sortKey: 'margin',
  },
  {
    id: 'rappel',
    header: { label: 'MARGEN RECUPERADO', sortable: true, align: 'right', rowSpan: 2 },
    accessor: (d) => d.budget.compliance,
    cellRenderer: percentCell,
    align: 'right',
    sortable: true,
    sortKey: 'budget',
  },
  {
    id: 'margenRappel',
    header: { label: 'MARGEN TOTAL', sortable: true, align: 'right', rowSpan: 2 },
    accessor: (d) => d.retained.compliance,
    cellRenderer: percentCell,
    align: 'right',
    sortable: true,
    sortKey: 'retained',
  },
  {
    id: 'pedidoPromedio',
    header: { label: 'PEDIDO PROMEDIO', sortable: true, align: 'right', rowSpan: 2 },
    accessor: (d) => d.retained.amount,
    cellRenderer: currencyCell,
    align: 'right',
    sortable: true,
    sortKey: 'avgOrder',
  },
];

/**
 * Budget columns, shown only when the current grouping/filters are
 * budget-applicable (the rows carry a non-null presupuesto).
 */
const FESTIVAL_BUDGET_COLUMNS: ColumnDefinition[] = [
  {
    id: 'ppto',
    header: { label: 'PPTO FESTIVAL', sortable: true, align: 'right', rowSpan: 2 },
    accessor: (d) => d.margin.budget,
    cellRenderer: currencyCell,
    align: 'right',
    sortable: true,
    sortKey: 'ppto',
  },
  {
    id: 'pptoCumpl',
    header: { label: 'CUMPL. PPTO', sortable: true, align: 'right', rowSpan: 2 },
    accessor: (d) => d.margin.previous,
    cellRenderer: complianceCell,
    align: 'right',
    sortable: true,
    sortKey: 'pptoCumpl',
  },
];

/**
 * Festival columns with the first column labelled for the current dimension.
 * Budget columns are inserted after VENTAS only when applicable.
 */
export function getFestivalColumns(firstColLabel: string, includeBudget: boolean): ColumnDefinition[] {
  const columns = FESTIVAL_COLUMNS.flatMap((c) =>
    c.id === 'sales' && includeBudget ? [c, ...FESTIVAL_BUDGET_COLUMNS] : [c]
  );
  return columns.map((c) =>
    c.id === 'name' ? { ...c, header: { ...c.header, label: firstColLabel.toUpperCase() } } : c
  );
}
