import { describe, it, expect } from 'vitest';
import { usesFacturadoOnly, getSalesMetric, getSalesOrderByField, getUnitMetric, getAvgOrderMetric, type SalesMetricSource } from './salesMetric';

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

describe('getUnitMetric', () => {
  const units = {
    units: 10, units_total: 15, avg_unit_cost: 40, avg_unit_cost_total: 42,
    units_last_year: 8, units_total_last_year: 12, avg_unit_cost_last_year: 38, avg_unit_cost_total_last_year: 39,
    avg_unit_price: 50, avg_unit_price_total: 52, avg_unit_price_last_year: 47, avg_unit_price_total_last_year: 48,
  };

  it('uses facturado units and cost (current and last year) on closed periods, like VENTAS', () => {
    expect(getUnitMetric(units, 'previous-month')).toEqual({ units: 10, unitsLastYear: 8, avgCost: 40, avgCostLastYear: 38, avgPrice: 50, avgPriceLastYear: 47 });
  });

  it('uses facturado + comprometido units and cost on open periods, like VENTAS', () => {
    expect(getUnitMetric(units, 'current-month')).toEqual({ units: 15, unitsLastYear: 12, avgCost: 42, avgCostLastYear: 39, avgPrice: 52, avgPriceLastYear: 48 });
  });

  it('falls back to zero when the listing carries no unit fields', () => {
    expect(getUnitMetric({}, 'current-month')).toEqual({ units: 0, unitsLastYear: 0, avgCost: 0, avgCostLastYear: 0, avgPrice: 0, avgPriceLastYear: 0 });
  });
});

describe('getAvgOrderMetric', () => {
  const orders = { avg_order: 100, avg_order_total: 120, avg_order_last_year: 90, avg_order_total_last_year: 110 };

  it('uses the facturado average order on closed periods, like VENTAS', () => {
    expect(getAvgOrderMetric(orders, 'accumulated')).toEqual({ current: 100, previous: 90 });
  });

  it('uses the facturado + comprometido average order on open periods, like VENTAS', () => {
    expect(getAvgOrderMetric(orders, 'current-month')).toEqual({ current: 120, previous: 110 });
  });

  it('falls back to zero when the listing carries no order fields', () => {
    expect(getAvgOrderMetric({}, 'current-month')).toEqual({ current: 0, previous: 0 });
  });
});
