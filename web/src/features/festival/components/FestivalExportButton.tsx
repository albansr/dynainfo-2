import { useState } from 'react';
import { Button } from '@heroui/react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { API_URL } from '@/core/config/constants';
import { useMergedFilters } from '../hooks/useFestivalBalance';

interface FestivalExportButtonProps {
  /** Event window (comparison is irrelevant to the listing export). */
  startDate: Date;
  endDate: Date;
  groupBy: string;
  /** First-column header, e.g. "Proveedor". */
  dimensionLabel: string;
  /** Accumulated drill filters (role filters are merged automatically). */
  filters: Record<string, unknown>;
  /** Report title shown at the top of the file (festival + drill context). */
  reportTitle: string;
  disabled?: boolean;
}

const fmtLongDate = (d: Date) => format(d, "d 'de' MMMM 'de' yyyy", { locale: es });

/** Download the current festival listing as a styled Excel file. */
export function FestivalExportButton({
  startDate,
  endDate,
  groupBy,
  dimensionLabel,
  filters,
  reportTitle,
  disabled,
}: FestivalExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const mergedFilters = useMergedFilters(filters);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        groupBy,
        dimensionLabel,
        reportTitle,
        periodLabel: `${fmtLongDate(startDate)} – ${fmtLongDate(endDate)}`,
        generatedLabel: fmtLongDate(new Date()),
      });

      const filename = `Festival_${dimensionLabel}_${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`;
      params.append('filename', filename);

      if (mergedFilters) {
        for (const [key, value] of Object.entries(mergedFilters)) {
          if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, String(v)));
          } else if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
      }

      const response = await fetch(`${API_URL}/api/festival/list/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        toast.error('No se pudo generar el archivo Excel');
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
      isDisabled={disabled}
      onPress={handleExport}
    >
      Exportar a Excel
    </Button>
  );
}
