import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { mapListItemToExportRow, calculateExportTotals } from '../../../src/features/list/list.export.transform.js';
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
