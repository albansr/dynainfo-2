import { useDateRange } from '@/core/hooks/useDateRange';
import { PRESET_LABELS } from '@/core/config/dateRangeConfig';
import { DateRangeFilter } from '@/features/dashboard/components/DateRangeFilter';

interface PageHeaderProps {
  title: string;
  showDateFilter?: boolean;
  /** Optional view/scope name shown next to the title. */
  chip?: string;
  /** Render the chip as muted text (default) or dark like the title. */
  chipMuted?: boolean;
  /** Optional breadcrumbs rendered above the title. */
  breadcrumbs?: React.ReactNode;
  /** Optional control rendered before the date filter (e.g. a view selector). */
  leadingControl?: React.ReactNode;
  /** Optional element rendered inline after the title (e.g. a live badge). */
  titleAccessory?: React.ReactNode;
  /**
   * Overrides the date-derived subtitle line. Use when the page has its own
   * date window (e.g. the festival event range) instead of the global range.
   */
  subtitle?: React.ReactNode;
}

export function PageHeader({ title, showDateFilter = true, chip, chipMuted = true, breadcrumbs, leadingControl, titleAccessory, subtitle }: PageHeaderProps) {
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
          {breadcrumbs && <div className="mb-1">{breadcrumbs}</div>}
          <div className="flex items-center gap-2">
            {title && (
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
                {title}
              </h1>
            )}
            {chip && (
              <span className={`text-xl sm:text-2xl ${chipMuted ? 'font-light text-zinc-400' : 'font-bold text-zinc-900'}`}>
                {chipMuted ? `· ${chip}` : chip}
              </span>
            )}
            {titleAccessory}
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            {subtitle ?? `${periodLabel || `Año ${currentYear}`} · ${formattedRange}`}
          </p>
        </div>
        {(leadingControl || showDateFilter) && (
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {leadingControl && <div className="w-full sm:w-64">{leadingControl}</div>}
            {showDateFilter && (
              <div className="w-full sm:w-64">
                <DateRangeFilter />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
