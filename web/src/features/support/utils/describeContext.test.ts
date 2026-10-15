import { describe, it, expect } from 'vitest';
import { describeContext } from './describeContext';

const dateRange = { start: '2026-01-01T12:00:00.000Z', end: '2026-09-30T12:00:00.000Z', preset: 'accumulated' };

describe('describeContext', () => {
  it('names the detail page by its trail and every filter by its label', () => {
    expect(
      describeContext({
        path: '/distribucion/detalle',
        search: '?channel=DISTRIBUCION&brand_group=exclusivas&g=ProveedorComercial&trail=Marcas%20Exclusivas',
        dateRange,
        dynaRole: 'SELLER',
        scope: 'CL07',
      }),
    ).toEqual({
      page: 'Detalle · Marcas Exclusivas',
      items: [
        { label: 'Agrupado por', value: 'Proveedor' },
        { label: 'Canal', value: 'Distribucion' },
        { label: 'Marcas (Aliadas y Exclusivas)', value: 'Marcas Exclusivas' },
        { label: 'Fechas', value: 'Acumulado · 01/01/2026 - 30/09/2026' },
        { label: 'Rol', value: 'Vendedor · CL07' },
      ],
    });
  });

  it('names the analysis view and marks excluded values', () => {
    const summary = describeContext({
      path: '/dashboard',
      search: '?v=marcas-aliadas&ProveedorComercial[neq][]=VERA&ProveedorComercial[neq][]=FORTE',
      dynaRole: null,
      scope: null,
    });

    expect(summary.page).toBe('Análisis · Marcas Aliadas');
    expect(summary.items).toEqual([
      { label: 'Proveedor (excepto)', value: 'VERA, FORTE' },
      { label: 'Rol', value: 'Sin rol' },
    ]);
  });

  it('falls back to the path for unknown pages and omits what is missing', () => {
    expect(describeContext({ path: '/otra' })).toEqual({ page: '/otra', items: [] });
    expect(describeContext({ path: '/estado/riesgo' }).page).toBe('Estado');
  });
});
