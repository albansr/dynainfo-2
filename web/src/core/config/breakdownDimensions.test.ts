import { describe, it, expect } from 'vitest';
import { groupingShowsCartera } from './breakdownDimensions';

describe('groupingShowsCartera', () => {
  it('keeps RET. CARTERA for groupings dyna_cartera can break down', () => {
    for (const g of ['seller_id', 'IdRegional', 'customer_id', 'ProveedorComercial', 'brand_group'] as const) {
      expect(groupingShowsCartera(g)).toBe(true);
    }
  });

  it('hides it where cartera always reads 0 (column not in dyna_cartera) and for products', () => {
    for (const g of ['channel', 'Marca', 'Categoria', 'CentroOperaciones', 'customer_country', 'SegmentacionProducto', 'product_id'] as const) {
      expect(groupingShowsCartera(g)).toBe(false);
    }
  });
});
