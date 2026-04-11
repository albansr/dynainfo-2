import type { Column, DataTableRow } from '../types/table';
import type { BalanceSheetData } from '@/core/api/types';
import { formatCurrency, formatPercentage } from '@/core/utils/formatters';
import { getSalesMetric, usesFacturadoOnly, type SalesMetricPreset } from '@/core/utils/salesMetric';

// Definición de columnas - fácil de extender
export const getDashboardTableColumns = (preset: SalesMetricPreset): Column[] => {
  const facturadoOnly = usesFacturadoOnly(preset);
  const currentYearLabel = facturadoOnly ? 'Facturado 2025' : 'Facturado + Comprometido 2025';
  return [
    {
      key: 'label',
      label: 'DETALLE',
      align: 'left',
    },
    {
      key: 'ventas_2024',
      label: 'VENTAS 2024',
      align: 'right',
    },
    {
      key: 'margen_2024',
      label: 'Margen 2024',
      align: 'right',
    },
    {
      key: 'facturado_2025',
      label: currentYearLabel,
      align: 'right',
    },
    {
      key: 'margen_2025',
      label: 'Margen 2025',
      align: 'right',
    },
    {
      key: 'variacion',
      label: 'Variación 2025 vs 2024',
      align: 'right',
    },
    {
      key: 'presupuesto',
      label: 'Presupuesto',
      align: 'right',
    },
    {
      key: 'margen_presupuesto',
      label: 'Margen Presupuesto',
      align: 'right',
    },
    {
      key: 'cumplimiento',
      label: 'Cumplimiento presupuesto',
      align: 'right',
    },
  ];
};

// Mapea los datos de la API a las filas de la tabla
export const getDashboardTableRows = (
  apiData: BalanceSheetData | undefined,
  preset: SalesMetricPreset
): DataTableRow[] => {
  if (!apiData) {
    return [];
  }

  const salesMetric = getSalesMetric(apiData, preset);
  const marginPct2025 = salesMetric.current !== 0 ? (apiData.gross_margin / salesMetric.current) * 100 : 0;
  const marginPct2024 = salesMetric.lastYear !== 0 ? (apiData.gross_margin_last_year / salesMetric.lastYear) * 100 : 0;

  return [
    {
      key: 'ventas',
      label: 'Total ventas mes',
      ventas_2024: `$ ${formatCurrency(salesMetric.lastYear)}`,
      margen_2024: `${formatPercentage(marginPct2024)} %`,
      facturado_2025: `$ ${formatCurrency(salesMetric.current)}`,
      margen_2025: `${formatPercentage(marginPct2025)} %`,
      variacion: `${formatPercentage(salesMetric.vsLastYear)} %`,
      presupuesto: `$ ${formatCurrency(apiData.budget)}`,
      margen_presupuesto: `${formatPercentage(apiData.budget_gross_margin_pct)} %`,
      cumplimiento: `${formatPercentage(apiData.budget_achievement_pct)} %`,
    },
  ];
};
