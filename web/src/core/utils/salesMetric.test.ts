import { describe, it, expect } from 'vitest';
import { usesFacturadoOnly, getSalesMetric, getSalesOrderByField, type SalesMetricSource } from './salesMetric';

const source: SalesMetricSource = {
  sales: 100,
  sales_last_year: 80,
  sales_vs_last_year: 25,
  sales_total: 130,
  sales_total_last_year: 100,
  sales_total_vs_last_year: 30,
};

describe('usesFacturadoOnly', () => {
  it('is true for closed periods (previous-month, accumulated)', () => {
    expect(usesFacturadoOnly('previous-month')).toBe(true);
    expect(usesFacturadoOnly('accumulated')).toBe(true);
  });

  it('is false for open periods', () => {
    expect(usesFacturadoOnly('today')).toBe(false);
    expect(usesFacturadoOnly('current-month')).toBe(false);
    expect(usesFacturadoOnly(2025)).toBe(false);
  });
});

describe('getSalesMetric', () => {
  it('uses facturado (sales) on closed periods with the facturado label', () => {
    const m = getSalesMetric(source, 'previous-month');
    expect(m.current).toBe(100);
    expect(m.lastYear).toBe(80);
    expect(m.label).toBe('VENTAS (Facturado)');
  });

  it('uses sales_total (facturado + comprometido) on open periods', () => {
    const m = getSalesMetric(source, 'current-month');
    expect(m.current).toBe(130);
    expect(m.lastYear).toBe(100);
    expect(m.label).toBe('VENTAS (Facturado + comprometido)');
  });

  it('returns zeros (not a crash) when the source is undefined', () => {
    const m = getSalesMetric(undefined, 'today');
    expect(m.current).toBe(0);
    expect(m.lastYear).toBe(0);
  });
});

describe('getSalesOrderByField', () => {
  it('orders by sales on closed periods and sales_total on open ones', () => {
    expect(getSalesOrderByField('accumulated')).toBe('sales');
    expect(getSalesOrderByField('today')).toBe('sales_total');
  });
});
