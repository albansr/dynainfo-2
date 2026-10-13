import { describe, it, expect } from 'vitest';
import { listsGroupsWithoutSales } from '../../../src/core/config/list-groupings.config.js';

describe('listsGroupsWithoutSales', () => {
  it('includes groups with only budget or cartera (sellers, regionals, customers…)', () => {
    for (const g of ['seller_id', 'IdRegional', 'ProveedorComercial', 'channel', 'customer_id', 'customer_name']) {
      expect(listsGroupsWithoutSales(g)).toBe(true);
    }
  });

  it('stays driven by sales for products and dimensions only sales carry', () => {
    for (const g of ['product_id', 'Categoria']) expect(listsGroupsWithoutSales(g)).toBe(false);
  });
});
