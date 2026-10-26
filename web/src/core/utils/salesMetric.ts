import type { DateRangePreset } from '@/core/config/dateRangeConfig';

export type SalesMetricPreset = DateRangePreset | 'custom';

export interface SalesMetricSource {
  sales: number;
  sales_last_year: number;
  sales_vs_last_year: number;
  sales_total: number;
  sales_total_last_year: number;
  sales_total_vs_last_year: number;
}

export interface SalesMetricValues {
  current: number;
  lastYear: number;
  vsLastYear: number;
  label: string;
}

const FACTURADO_LABEL = 'VENTAS (Facturado)';
const FACTURADO_COMPROMETIDO_LABEL = 'VENTAS (Facturado + comprometido)';

/**
 * Returns true when the preset represents a fully-closed past period
 * where pedidos comprometidos are no longer meaningful.
 */
export function usesFacturadoOnly(preset: SalesMetricPreset): boolean {
  return preset === 'previous-month' || preset === 'accumulated';
}

/**
 * Resolves the sales metric values (current, last year, YoY variation, label)
 * from a source object, picking `sales` or `sales_total` based on preset.
 */
export function getSalesMetric(
  source: SalesMetricSource | undefined,
  preset: SalesMetricPreset
): SalesMetricValues {
  const facturadoOnly = usesFacturadoOnly(preset);
  if (!source) {
    return {
      current: 0,
      lastYear: 0,
      vsLastYear: 0,
      label: facturadoOnly ? FACTURADO_LABEL : FACTURADO_COMPROMETIDO_LABEL,
    };
  }
  return {
    current: facturadoOnly ? source.sales : source.sales_total,
    lastYear: facturadoOnly ? source.sales_last_year : source.sales_total_last_year,
    vsLastYear: facturadoOnly ? source.sales_vs_last_year : source.sales_total_vs_last_year,
    label: facturadoOnly ? FACTURADO_LABEL : FACTURADO_COMPROMETIDO_LABEL,
  };
}

export interface UnitMetricSource {
  units?: number;
  units_total?: number;
  avg_unit_cost?: number;
  avg_unit_cost_total?: number;
  units_last_year?: number;
  units_total_last_year?: number;
  avg_unit_cost_last_year?: number;
  avg_unit_cost_total_last_year?: number;
  avg_unit_price?: number;
  avg_unit_price_total?: number;
  avg_unit_price_last_year?: number;
  avg_unit_price_total_last_year?: number;
}

export interface UnitMetricValues {
  units: number;
  unitsLastYear: number;
  avgCost: number;
  avgCostLastYear: number;
  avgPrice: number;
  avgPriceLastYear: number;
}

/**
 * Resolves units and average cost per unit with the same rule as the sales
 * metric: facturado only on closed periods, facturado + comprometido otherwise,
 * so they stay consistent with the VENTAS shown in the same row.
 */
export function getUnitMetric(source: UnitMetricSource, preset: SalesMetricPreset): UnitMetricValues {
  const facturadoOnly = usesFacturadoOnly(preset);
  return {
    units: (facturadoOnly ? source.units : source.units_total) ?? 0,
    unitsLastYear: (facturadoOnly ? source.units_last_year : source.units_total_last_year) ?? 0,
    avgCost: (facturadoOnly ? source.avg_unit_cost : source.avg_unit_cost_total) ?? 0,
    avgCostLastYear: (facturadoOnly ? source.avg_unit_cost_last_year : source.avg_unit_cost_total_last_year) ?? 0,
    avgPrice: (facturadoOnly ? source.avg_unit_price : source.avg_unit_price_total) ?? 0,
    avgPriceLastYear: (facturadoOnly ? source.avg_unit_price_last_year : source.avg_unit_price_total_last_year) ?? 0,
  };
}

export interface AvgOrderSource {
  avg_order?: number;
  avg_order_total?: number;
  avg_order_last_year?: number;
  avg_order_total_last_year?: number;
}

/**
 * Average order value (current + last year) with the same facturado vs
 * facturado + comprometido rule as the sales metric.
 */
export function getAvgOrderMetric(source: AvgOrderSource, preset: SalesMetricPreset): { current: number; previous: number } {
  const facturadoOnly = usesFacturadoOnly(preset);
  return {
    current: (facturadoOnly ? source.avg_order : source.avg_order_total) ?? 0,
    previous: (facturadoOnly ? source.avg_order_last_year : source.avg_order_total_last_year) ?? 0,
  };
}

/**
 * Returns the field name to use for backend ordering (useList.orderBy).
 */
export function getSalesOrderByField(preset: SalesMetricPreset): 'sales' | 'sales_total' {
  return usesFacturadoOnly(preset) ? 'sales' : 'sales_total';
}
