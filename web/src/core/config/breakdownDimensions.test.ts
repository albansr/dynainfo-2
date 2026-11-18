import { describe, it, expect } from 'vitest';
import { buildDetailUrl, detailUrl, listingShowsBudget, listingShowsCartera, parseDetailParams } from './breakdownDimensions';

describe('listingShowsBudget / listingShowsCartera', () => {
  it('shows both for groupings budget and cartera break down', () => {
    for (const g of ['seller_id', 'IdRegional', 'ProveedorComercial', 'channel', 'brand_group', 'month'] as const) {
      expect(listingShowsBudget(g)).toBe(true);
      expect(listingShowsCartera(g)).toBe(true);
    }
  });

  it('shows RET. CARTERA but not the budget by customer (the budget has no customers)', () => {
    for (const g of ['customer_id', 'customer_name'] as const) {
      expect(listingShowsBudget(g)).toBe(false);
      expect(listingShowsCartera(g)).toBe(true);
    }
    expect(listingShowsBudget('seller_id', { customer_id: '71083892' })).toBe(false);
    expect(listingShowsCartera('seller_id', { customer_id: '71083892' })).toBe(true);
  });

  it('hides both where neither table has the dimension (categories, cities…)', () => {
    for (const g of ['Marca', 'Categoria', 'CentroOperaciones', 'customer_country', 'SegmentacionProducto'] as const) {
      expect(listingShowsBudget(g)).toBe(false);
      expect(listingShowsCartera(g)).toBe(false);
    }
    expect(listingShowsCartera('IdRegional', { channel: 'DISTRIBUCION', Categoria: 'CERRAJERIA' })).toBe(false);
  });

  it('keeps both under role and brand filters they can apply', () => {
    expect(listingShowsBudget('IdRegional', { channel: 'DISTRIBUCION', IdRegional: ['0002', '0004'] })).toBe(true);
    expect(listingShowsCartera('seller_id', { brand_group: 'exclusivas', seller_id: 'MD14' })).toBe(true);
  });

  it('reads filters with an operator suffix by their dimension (Marcas Aliadas)', () => {
    const aliadas = { 'ProveedorComercial[neq][]': ['VERA', 'FORTE'] };
    expect(listingShowsBudget('ProveedorComercial', aliadas)).toBe(true);
    expect(listingShowsCartera('ProveedorComercial', aliadas)).toBe(true);
    expect(listingShowsBudget('ProveedorComercial', { 'Categoria[neq][]': ['X'] })).toBe(false);
  });
});

/** Query string of a detail URL. */
const query = (url: string) => url.slice(url.indexOf('?') + 1);

describe('detail drill path', () => {
  it('records the origin view and splits its filters from the drill steps', () => {
    const url = buildDetailUrl('distribucion', { channel: 'DISTRIBUCION' }, 'IdRegional', '0002', 'REGIONAL ANDINA');
    const drilled = parseDetailParams(query(url));
    const next = detailUrl({ ...drilled, steps: [...drilled.steps, ['seller_id', 'BG02']], trail: [...drilled.trail, 'BG02'] });

    expect(parseDetailParams(query(next))).toMatchObject({
      viewId: 'distribucion',
      seed: [['channel', 'DISTRIBUCION']],
      steps: [['IdRegional', '0002'], ['seller_id', 'BG02']],
      trail: ['REGIONAL ANDINA', 'BG02'],
      groupBy: 'ProveedorComercial',
    });
  });

  it('rebuilds a breadcrumb level with the origin filters, never an assumed channel', () => {
    // Retail is filtered by regional, not channel: the seed must not count as a step.
    const url = buildDetailUrl('retail', { IdRegional: 'RTL' }, 'CentroOperaciones', '006', 'Centro 2');
    const drilled = parseDetailParams(query(url));
    const deeper = parseDetailParams(query(detailUrl({ ...drilled, steps: [...drilled.steps, ['customer_id', 'C1']], trail: [...drilled.trail, 'Cliente 1'] })));

    const back = parseDetailParams(query(detailUrl({ ...deeper, steps: deeper.steps.slice(0, 1), trail: deeper.trail.slice(0, 1) })));
    expect(back.filters).toEqual({ IdRegional: 'RTL', CentroOperaciones: '006' });
    expect(back.trail).toEqual(['Centro 2']);
  });

  it('keeps multi-value view filters as arrays (Exportaciones + Cadenas, Marcas Aliadas)', () => {
    const both = parseDetailParams(query(buildDetailUrl('todos-nuevos-canales', { channel: ['EXPORTACIONES', 'CADENAS'] }, 'customer_id', 'C1', 'Cliente 1')));
    expect(both.filters.channel).toEqual(['EXPORTACIONES', 'CADENAS']);

    const aliadas = parseDetailParams(query(buildDetailUrl('marcas-aliadas', { 'ProveedorComercial[neq][]': ['VERA', 'FORTE'] }, 'ProveedorComercial', 'P1', 'Proveedor 1')));
    expect(aliadas.filters['ProveedorComercial[neq][]']).toEqual(['VERA', 'FORTE']);
  });

  it('drilling into a value of a multi-value view filter narrows it to that value', () => {
    const url = buildDetailUrl('marcas-exclusivas', { ProveedorComercial: ['VERA', 'FORTE'] }, 'ProveedorComercial', 'VERA', 'VERA');
    expect(parseDetailParams(query(url))).toMatchObject({ seed: [], steps: [['ProveedorComercial', 'VERA']], filters: { ProveedorComercial: 'VERA' } });
  });

  it('never groups by a dimension already filtered, so a drill cannot overwrite a step', () => {
    // Cliente → Proveedor, but a provider was already drilled.
    const url = detailUrl({
      viewId: 'distribucion',
      seed: [['channel', 'DISTRIBUCION']],
      steps: [['ProveedorComercial', 'P1'], ['product_id', 'X1'], ['customer_id', 'C1']],
      trail: ['Proveedor 1', 'Producto 1', 'Cliente 1'],
    });
    const { groupBy, filters } = parseDetailParams(query(url));
    expect(groupBy in filters).toBe(false);
  });

  it('reads links made before the origin view was recorded', () => {
    const old = parseDetailParams('channel=DISTRIBUCION&IdRegional=0002&g=seller_id&trail=REGIONAL+ANDINA');
    expect(old).toMatchObject({ viewId: null, seed: [['channel', 'DISTRIBUCION']], steps: [['IdRegional', '0002']], groupBy: 'seller_id' });
  });
});
