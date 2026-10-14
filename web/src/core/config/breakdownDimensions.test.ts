import { describe, it, expect } from 'vitest';
import { listingShowsBudget, listingShowsCartera } from './breakdownDimensions';

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
