import { describe, it, expect } from 'vitest';
import { DRILL_TARGET, DRILL_TARGET_FALLBACK } from './drillTarget';

describe('DRILL_TARGET (shared drill chain)', () => {
  it('drills Marcas → Proveedor → Producto → Cliente', () => {
    expect(DRILL_TARGET.brand_group).toBe('ProveedorComercial');
    expect(DRILL_TARGET.ProveedorComercial).toBe('product_id');
    expect(DRILL_TARGET.product_id).toBe('customer_id');
  });

  it('drills Regional → Vendedor → Proveedor', () => {
    expect(DRILL_TARGET.IdRegional).toBe('seller_id');
    expect(DRILL_TARGET.seller_id).toBe('ProveedorComercial');
  });

  it('drills Categoría → Marca → Producto', () => {
    expect(DRILL_TARGET.Categoria).toBe('Marca');
    expect(DRILL_TARGET.Marca).toBe('product_id');
  });

  it('crosses Cliente → Proveedor', () => {
    expect(DRILL_TARGET.customer_id).toBe('ProveedorComercial');
  });

  it('has a customer_id fallback for dimensions with no explicit target', () => {
    expect(DRILL_TARGET.CentroOperaciones).toBeUndefined();
    expect(DRILL_TARGET_FALLBACK).toBe('customer_id');
  });
});
