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
  return preset === 'previous-month';
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

/**
 * Returns the field name to use for backend ordering (useList.orderBy).
 */
export function getSalesOrderByField(preset: SalesMetricPreset): 'sales' | 'sales_total' {
  return usesFacturadoOnly(preset) ? 'sales' : 'sales_total';
}
