import { useState } from 'react';
import { Button } from '@heroui/react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { API_URL } from '@/core/config/constants';
import type { GroupByDimension } from '@/core/api/hooks/useList';
import { getSalesOrderByField, usesFacturadoOnly, type SalesMetricPreset } from '@/core/utils/salesMetric';
import { getDimensionLabel } from '@/core/utils/dimensionLabels';

interface ExportToExcelButtonProps {
  groupBy: GroupByDimension;
  startDate: Date;
  endDate: Date;
  preset: SalesMetricPreset;
  filters?: Record<string, any>;
  totalsLabel: string;
  hideBudgetColumns: boolean;
  hideRetainedColumn: boolean;
  nameOverrides?: Record<string, string>;
  /** Page title, shown as the report title in the exported file. */
  reportTitle: string;
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
}: ExportToExcelButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const currentYear = endDate.getFullYear();
      const params = new URLSearchParams();
      params.append('groupBy', groupBy);
      params.append('startDate', format(startDate, 'yyyy-MM-dd'));
      params.append('endDate', format(endDate, 'yyyy-MM-dd'));
      params.append('preset', String(preset));
      params.append('orderBy', getSalesOrderByField(preset));
      params.append('orderDirection', 'desc');
      params.append('totalsLabel', totalsLabel);
      params.append('dimensionLabel', getDimensionLabel(groupBy));
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
      const filename = `${getDimensionLabel(groupBy)}_${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`;
      params.append('filename', filename);

      // Dynamic filters (mirrors useList's fetchList spreading)
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, String(v)));
          } else if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
      }

      const response = await fetch(`${API_URL}/api/list/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        let message = 'No se pudo generar el archivo Excel';
        try {
          const body = await response.json();
          if (body?.message) message = body.message;
        } catch {
          // non-JSON error body — keep default message
        }
        toast.error(message);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Exportación completada');
    } catch {
      toast.error('No se pudo generar el archivo Excel');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="flat"
      color="primary"
      startContent={!isExporting && <ArrowDownTrayIcon className="h-4 w-4" />}
      isLoading={isExporting}
      onPress={handleExport}
    >
      Exportar a Excel
    </Button>
  );
}
