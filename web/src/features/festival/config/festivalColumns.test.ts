import { describe, it, expect } from 'vitest';
import { getFestivalColumns, festivalRowsToRegionalData } from './festivalColumns';
import type { FestivalListRow } from '../hooks/useFestivalBalance';

const row: FestivalListRow = {
  id: 'P1',
  name: 'Producto 1',
  sales_total: 1500,
  gross_margin_pct: 30,
  rappel_pct: 2,
  margen_rappel_pct: 32,
  comprometido: 600,
  pedido_promedio: 500,
  clientes_unicos: 3,
  productos_unicos: 1,
  clientes_sin_compra: 0,
  presupuesto: null,
  cumplimiento_ppto: null,
};

describe('festival product unit columns', () => {
  it('adds UNIDADES + PRECIO PROMEDIO + COSTO PROMEDIO after PEDIDO PROMEDIO when grouping by product', () => {
    const ids = getFestivalColumns('Producto', false, 'product_id').map((c) => c.id);
    const at = ids.indexOf('pedidoPromedio');

    expect(ids.slice(at + 1, at + 4)).toEqual(['units', 'avgUnitPrice', 'avgUnitCost']);
  });

  it('does not add unit columns for other groupings', () => {
    const ids = getFestivalColumns('Proveedor', false, 'ProveedorComercial').map((c) => c.id);

    expect(ids).not.toContain('units');
    expect(ids).not.toContain('avgUnitCost');
  });

  it('maps units and average cost onto the table rows only when the API sends them', () => {
    const [withUnits, withoutUnits] = festivalRowsToRegionalData([
      { ...row, sales_total: 1500, units_total: 15, avg_unit_cost_total: 42 },
      { ...row, id: 'P2' },
    ]);

    expect(withUnits!.units).toEqual({ current: 15, avgCost: 42, avgPrice: 100 });
    expect(withoutUnits!.units).toBeUndefined();
  });
});
