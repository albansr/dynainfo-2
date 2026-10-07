import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { FestivalService } from '../../../src/features/festival/festival.service.js';
import { buildFestivalExportWorkbook } from '../../../src/features/festival/festival.export.workbook.js';
import type { FestivalListRow } from '../../../src/features/festival/festival.schemas.js';
import type { IAnalyticsQueryBuilder } from '../../../src/core/db/clickhouse/query/interfaces.js';

describe('festival product listing: units and average unit cost', () => {
  let builder: IAnalyticsQueryBuilder;
  let service: FestivalService;

  beforeEach(() => {
    builder = {
      buildGroupedMultiTableYoYQuery: vi.fn().mockResolvedValue([
        { id: 'P1', name: 'Producto 1', sales: 900, sales_total: 1500, orders: 600, units_total: 15, avg_unit_cost_total: 42 },
      ]),
      buildGroupedDistinctCountQuery: vi.fn().mockResolvedValue(new Map()),
      buildGroupedDistinctCountExcludingQuery: vi.fn().mockResolvedValue(new Map()),
      buildGroupedAttributeQuery: vi.fn().mockResolvedValue(new Map([['P1', '1001']])),
    } as unknown as IAnalyticsQueryBuilder;
    service = new FestivalService(builder);
  });

  const metricAliases = (): string[] =>
    vi.mocked(builder.buildGroupedMultiTableYoYQuery).mock.calls[0]![0].metrics.map((m) => m.alias);

  it('queries units/cost and returns facturado + comprometido units and average cost per product', async () => {
    const [row] = await service.getFestivalList({ currentFilters: [], universeFilters: [], groupBy: 'product_id' });

    expect(metricAliases()).toEqual(expect.arrayContaining(['units', 'cost', 'orders_units', 'orders_cost']));
    expect(row).toMatchObject({ code: '1001', sales_total: 1500, units_total: 15, avg_unit_cost_total: 42 });
  });

  it('leaves non-product listings unchanged', async () => {
    const [row] = await service.getFestivalList({ currentFilters: [], universeFilters: [], groupBy: 'seller_id' });

    expect(metricAliases()).not.toContain('units');
    expect(row).not.toHaveProperty('units_total');
    expect(row).not.toHaveProperty('avg_unit_cost_total');
  });
});

describe('festival export workbook unit columns', () => {
  const row = {
    id: 'P1', name: 'Producto 1', sales_total: 1500, gross_margin_pct: 30, rappel_pct: 2, margen_rappel_pct: 32,
    comprometido: 600, pedido_promedio: 500, clientes_unicos: 3, productos_unicos: 1, clientes_sin_compra: 0,
    presupuesto: null, cumplimiento_ppto: null, units_total: 15, avg_unit_cost_total: 42,
  } satisfies FestivalListRow;

  const headers = async (showUnitColumns?: boolean): Promise<string[]> => {
    const buffer = await buildFestivalExportWorkbook({
      rows: [row],
      dimensionLabel: 'Producto',
      includeBudget: false,
      hideNumerica: false,
      hideItems: true,
      showProductCode: true,
      ...(showUnitColumns !== undefined && { showUnitColumns }),
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    const headerRow = [1, 2, 3, 4, 5, 6].map((r) => ws.getRow(r)).find((r) => r.getCell(1).value === 'CÓDIGO ITEM')!;
    return (headerRow.values as unknown[]).filter((v): v is string => typeof v === 'string');
  };

  it('keeps the legacy export unchanged without the opt-in flag', async () => {
    expect(await headers()).not.toContain('Unidades');
  });

  it('adds Unidades + Precio Promedio + Costo Promedio after Pedido Promedio when requested', async () => {
    const cols = await headers(true);
    const at = cols.indexOf('Pedido Promedio');
    expect(cols.slice(at + 1, at + 4)).toEqual(['Unidades', 'Precio Promedio', 'Costo Promedio']);
  });
});
