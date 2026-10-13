import { describe, it, expect } from 'vitest';
import { listingShowsBudgetAndCartera } from './breakdownDimensions';

describe('listingShowsBudgetAndCartera', () => {
  it('shows budget and RET. CARTERA for groupings both tables can break down', () => {
    for (const g of ['seller_id', 'IdRegional', 'ProveedorComercial', 'channel', 'brand_group', 'month'] as const) {
      expect(listingShowsBudgetAndCartera(g)).toBe(true);
    }
  });

  it('hides them where they always read 0: customers, products, categories…', () => {
    for (const g of ['customer_id', 'customer_name', 'product_id', 'Marca', 'Categoria', 'CentroOperaciones', 'customer_country', 'SegmentacionProducto'] as const) {
      expect(listingShowsBudgetAndCartera(g)).toBe(false);
    }
  });

  it('keeps them under role and drill filters they can apply (channel, regional, seller, brands)', () => {
    expect(listingShowsBudgetAndCartera('IdRegional', { channel: 'DISTRIBUCION', IdRegional: ['0002', '0004'] })).toBe(true);
    expect(listingShowsBudgetAndCartera('seller_id', { brand_group: 'exclusivas', seller_id: 'MD14' })).toBe(true);
  });

  it('hides them as soon as a filter cannot be applied to them (e.g. a Categoría drill)', () => {
    expect(listingShowsBudgetAndCartera('IdRegional', { channel: 'DISTRIBUCION', Categoria: 'CERRAJERIA' })).toBe(false);
    expect(listingShowsBudgetAndCartera('seller_id', { customer_id: '71083892' })).toBe(false);
  });
});
