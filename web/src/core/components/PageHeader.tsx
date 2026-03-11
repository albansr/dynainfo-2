import { useDateRange } from '@/core/hooks/useDateRange';
import { PRESET_LABELS } from '@/core/config/dateRangeConfig';
import { DateRangeFilter } from '@/features/dashboard/components/DateRangeFilter';

interface PageHeaderProps {
  title: string;
  showDateFilter?: boolean;
}

export function PageHeader({ title, showDateFilter = true }: PageHeaderProps) {
  const { preset, formattedRange, endDate } = useDateRange();
  const currentYear = endDate.getFullYear();

  const getPresetLabel = (preset: number | string): string => {
    if (typeof preset === 'number') return '';
    return PRESET_LABELS[preset] || preset;
  };

  const periodLabel = getPresetLabel(preset);

  return (
    <div className="sticky -top-4 z-10 bg-white -mx-4 xl:-mx-10 px-4 xl:px-10 -mt-4 pt-4 pb-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
            {title}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {periodLabel || `Año ${currentYear}`} · {formattedRange}
          </p>
        </div>
        {showDateFilter && (
          <div className="w-full sm:w-64">
            <DateRangeFilter />
          </div>
        )}
      </div>
    </div>
  );
}
