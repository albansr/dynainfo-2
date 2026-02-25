import { useDateRange } from '@/core/hooks/useDateRange';
import { DateRangeFilter } from '@/features/dashboard/components/DateRangeFilter';

interface PageHeaderProps {
  title: string;
  showDateFilter?: boolean;
}

export function PageHeader({ title, showDateFilter = true }: PageHeaderProps) {
  const { preset, formattedRange, endDate } = useDateRange();
  const currentYear = endDate.getFullYear();

  // Map preset to label
  const getPresetLabel = (preset: number | string): string => {
    if (typeof preset === 'number') return ''; // Don't show year in label
    const presetMap: Record<string, string> = {
      'current-month': 'Mes actual',
      'accumulated': 'Acumulado',
      'last-30-days': 'Últimos 30 días',
      'last-6-months': 'Últimos 6 meses',
      'last-12-months': 'Últimos 12 meses',
    };
    return presetMap[preset] || preset;
  };

  const periodLabel = getPresetLabel(preset);

  return (
    <div className="sticky -top-4 z-10 bg-white -mx-10 px-10 -mt-4 pt-4 pb-4 mb-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {title}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {periodLabel || `Año ${currentYear}`} · {formattedRange}
          </p>
        </div>
        {showDateFilter && (
          <div className="w-64">
            <DateRangeFilter />
          </div>
        )}
      </div>
    </div>
  );
}
