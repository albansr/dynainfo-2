import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { mapListItemToExportRow, calculateExportTotals, calendarMonthsInRange } from '../../../src/features/list/list.export.transform.js';
import { buildListExportWorkbook, type BuildWorkbookInput } from '../../../src/features/list/list.export.workbook.js';
import type { ListItemResponse } from '../../../src/features/list/list.schemas.js';

const item = (fields: Record<string, number | string>): ListItemResponse =>
  ({ id: 'P1', name: 'Producto 1', ...fields }) as unknown as ListItemResponse;

const productItem = item({
  sales: 1000,
  sales_total: 1500,
  units: 10,
  units_total: 15,
  avg_unit_cost: 40,
  avg_unit_cost_total: 42,
  cartera: 70,
});

describe('list export: units and average unit cost', () => {
  it('uses facturado + comprometido units/cost for open periods, like VENTAS', () => {
    const row = mapListItemToExportRow(productItem, 'current-month');
    expect(row.sales.current).toBe(1500);
    expect(row.units).toEqual({ current: 15, avgCost: 42, avgPrice: 0 });
  });

  it('uses facturado-only units/cost for closed periods, like VENTAS', () => {
    const row = mapListItemToExportRow(productItem, 'previous-month');
    expect(row.sales.current).toBe(1000);
    expect(row.units).toEqual({ current: 10, avgCost: 40, avgPrice: 0 });
  });

  it('totals units and weights the average cost by units (total cost / total units)', () => {
    const a = mapListItemToExportRow(item({ units_total: 10, avg_unit_cost_total: 40 }), 'current-month');
    const b = mapListItemToExportRow(item({ units_total: 30, avg_unit_cost_total: 20 }), 'current-month');
    const totals = calculateExportTotals([a, b], 'TOTAL:');
    expect(totals.units.current).toBe(40);
    expect(totals.units.avgCost).toBe((10 * 40 + 30 * 20) / 40);
    // Average price = total sales / total units
    expect(totals.units.avgPrice).toBe(totals.sales.current / 40);
  });

  it('reports a zero average cost when there are no units', () => {
    const totals = calculateExportTotals([mapListItemToExportRow(item({}), 'current-month')], 'TOTAL:');
    expect(totals.units).toEqual({ current: 0, avgCost: 0, avgPrice: 0 });
  });
});

describe('list export workbook columns', () => {
  const headers = async (overrides: Partial<BuildWorkbookInput>): Promise<string[]> => {
    const rows = [mapListItemToExportRow(productItem, 'current-month')];
    const buffer = await buildListExportWorkbook({
      rows,
      totals: calculateExportTotals(rows, 'TOTAL:'),
      hideBudgetColumns: true,
      hideRetainedColumn: false,
      showProductCode: true,
      dimensionLabel: 'Producto',
      billingLabel: 'Ventas',
      totalsLabel: 'TOTAL:',
      currentYear: 2026,
      previousYear: 2025,
      ...overrides,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const values = wb.worksheets[0]!.getRow(1).values as unknown[];
    return values.filter((v): v is string => typeof v === 'string');
  };

  it('keeps the legacy product export unchanged when unit columns are not requested', async () => {
    const cols = await headers({});
    expect(cols).toContain('Retenido en Cartera');
    expect(cols).not.toContain('Unidades');
    expect(cols).not.toContain('Costo Promedio');
  });

  it('swaps cartera for Unidades + Precio Promedio + Costo Promedio when the web opts in', async () => {
    const cols = await headers({ hideRetainedColumn: true, showUnitColumns: true });
    expect(cols).not.toContain('Retenido en Cartera');
    expect(cols).not.toContain('% Cumpl. Cartera');
    expect(cols.slice(-3)).toEqual(['Unidades', 'Precio Promedio', 'Costo Promedio']);
  });
});

describe('list export: average order (seller listings)', () => {
  const seller = item({
    sales: 1000, sales_total: 1500, sales_last_year: 800, sales_total_last_year: 900,
    avg_order: 100, avg_order_total: 125, avg_order_last_year: 80, avg_order_total_last_year: 90,
  });

  it('follows the same facturado vs facturado + comprometido rule as VENTAS', () => {
    expect(mapListItemToExportRow(seller, 'current-month').avgOrder).toEqual({ current: 125, previous: 90 });
    expect(mapListItemToExportRow(seller, 'previous-month').avgOrder).toEqual({ current: 100, previous: 80 });
  });

  it('weights the totals row by orders (total sales / total orders)', () => {
    // 1500 / 125 = 12 orders, 600 / 50 = 12 orders → 2100 / 24
    const other = item({ sales_total: 600, avg_order_total: 50 });
    const totals = calculateExportTotals(
      [mapListItemToExportRow(seller, 'current-month'), mapListItemToExportRow(other, 'current-month')],
      'TOTAL:'
    );
    expect(totals.avgOrder.current).toBe(2100 / 24);
  });
});

describe('calendarMonthsInRange (export)', () => {
  it('counts the calendar months a range touches, a partial month as one', () => {
    expect(calendarMonthsInRange('2025-01-01', '2025-12-31')).toBe(12);
    expect(calendarMonthsInRange('2026-10-01', '2026-10-10')).toBe(1);
    expect(calendarMonthsInRange('2026-04-26', '2026-10-26')).toBe(7);
    expect(calendarMonthsInRange('2025-11-15', '2026-02-03')).toBe(4);
  });
});

describe('list export workbook: customer and seller columns', () => {
  const build = async (overrides: Partial<BuildWorkbookInput>) => {
    const rows = [mapListItemToExportRow(item({ sales_total: 1200, sales_total_last_year: 600, avg_order_total: 300 }), 'current-month')];
    const buffer = await buildListExportWorkbook({
      rows,
      totals: calculateExportTotals(rows, 'TOTAL:'),
      hideBudgetColumns: true,
      hideRetainedColumn: false,
      dimensionLabel: 'Cliente',
      billingLabel: 'Ventas',
      totalsLabel: 'TOTAL:',
      currentYear: 2026,
      previousYear: 2025,
      ...overrides,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    const cells = (r: number) => (ws.getRow(r).values as unknown[]).slice(1);
    return { headers: cells(1), firstRow: cells(2) };
  };

  it('swaps cartera for Promedio Mensual (sales / months) on customer listings', async () => {
    const { headers, firstRow } = await build({ monthlyAvgMonths: 3 });
    expect(headers).not.toContain('Retenido en Cartera');
    expect(headers.slice(-2)).toEqual(['Promedio Mensual 2026', 'Promedio Mensual 2025']);
    expect(firstRow.slice(-2)).toEqual([400, 200]);
  });

  it('closes seller listings with Pedido Promedio', async () => {
    const { headers, firstRow } = await build({ showAvgOrder: true });
    expect(headers).toContain('Retenido en Cartera');
    expect(headers.slice(-2)).toEqual(['Pedido Promedio 2026', 'Pedido Promedio 2025']);
    expect(firstRow[headers.indexOf('Pedido Promedio 2026')]).toBe(300);
  });
});
