import { useState } from 'react';
import { Button } from '@heroui/react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { GroupByDimension } from '@/core/api/hooks/useList';
import { getSalesOrderByField, usesFacturadoOnly, type SalesMetricPreset } from '@/core/utils/salesMetric';
import { getDimensionLabel } from '@/core/utils/dimensionLabels';
import { useAuthStore } from '@/core/store/authStore';
import { canExport } from '@/core/config/access';
import { downloadExcel, appendFilterParams, type FilterMap } from '@/core/api/downloadExcel';

interface ExportToExcelButtonProps {
  groupBy: GroupByDimension;
  startDate: Date;
  endDate: Date;
  preset: SalesMetricPreset;
  filters?: FilterMap;
  totalsLabel: string;
  hideBudgetColumns: boolean;
  hideRetainedColumn: boolean;
  nameOverrides?: Record<string, string>;
  /** Page title, shown as the report title in the exported file. */
  reportTitle: string;
  /** Override the dimension column header in the export (defaults to the dimension label). */
  dimensionLabelOverride?: string;
  /** Disable the button (e.g. while the page data is loading). */
  disabled?: boolean;
}

/** Grouped billing header label, matching getColumnGroups() in the table config. */
function billingGroupLabel(preset: SalesMetricPreset): string {
  return usesFacturadoOnly(preset)
    ? 'Ventas (Facturación) VS Presupuesto'
    : 'Ventas (Facturación + Comprometido) VS Presupuesto';
}

const fmtLongDate = (d: Date) => format(d, "d 'de' MMMM 'de' yyyy", { locale: es });

/**
 * Human-readable reporting period, always using concrete dates so the file
 * stays unambiguous whenever it's opened. Single date when start == end,
 * otherwise a "start – end" range.
 */
function buildPeriodLabel(startDate: Date, endDate: Date): string {
  const sameDay = format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd');
  return sameDay ? fmtLongDate(startDate) : `${fmtLongDate(startDate)} – ${fmtLongDate(endDate)}`;
}

export function ExportToExcelButton({
  groupBy,
  startDate,
  endDate,
  preset,
  filters,
  totalsLabel,
  hideBudgetColumns,
  hideRetainedColumn,
  nameOverrides,
  reportTitle,
  dimensionLabelOverride,
  disabled,
}: ExportToExcelButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const dynaRole = useAuthStore((s) => s.user?.dynaRole);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const currentYear = endDate.getFullYear();
      const dimensionLabel = dimensionLabelOverride || getDimensionLabel(groupBy);
      const params = new URLSearchParams();
      params.append('groupBy', groupBy);
      params.append('startDate', format(startDate, 'yyyy-MM-dd'));
      params.append('endDate', format(endDate, 'yyyy-MM-dd'));
      params.append('preset', String(preset));
      params.append('orderBy', getSalesOrderByField(preset));
      params.append('orderDirection', 'desc');
      params.append('totalsLabel', totalsLabel);
      params.append('dimensionLabel', dimensionLabel);
      params.append('billingLabel', billingGroupLabel(preset));
      params.append('currentYear', String(currentYear));
      params.append('previousYear', String(currentYear - 1));
      params.append('reportTitle', reportTitle);
      params.append('periodLabel', buildPeriodLabel(startDate, endDate));
      params.append('generatedLabel', fmtLongDate(new Date()));
      if (hideBudgetColumns) params.append('hideBudgetColumns', 'true');
      if (hideRetainedColumn) params.append('hideRetainedColumn', 'true');
      if (nameOverrides) params.append('nameOverrides', JSON.stringify(nameOverrides));

      // Filename: dimension + date range (sanitized server-side too)
      const filename = `${dimensionLabel}_${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`;
      params.append('filename', filename);

      appendFilterParams(params, filters);

      await downloadExcel('/api/list/export', params, filename);
    } finally {
      setIsExporting(false);
    }
  };

  if (!canExport(dynaRole)) return null;

  return (
    <Button
      size="sm"
      variant="flat"
      color="primary"
      startContent={!isExporting && <ArrowDownTrayIcon className="h-4 w-4" />}
      isLoading={isExporting}
      isDisabled={disabled}
      onPress={handleExport}
    >
      Exportar a Excel
    </Button>
  );
}
