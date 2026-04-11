import {
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
  startOfYear,
  endOfYear,
  getYear,
} from 'date-fns';
import { AVAILABLE_DATA_RANGE, type DateRangePreset } from '../config/dateRangeConfig';

/**
 * Gets yesterday's date (last closed day)
 */
export const getYesterday = (): Date => {
  return subDays(new Date(), 1);
};

/**
 * Calculates date range based on preset
 */
export const calculatePresetRange = (
  preset: DateRangePreset
): { start: Date; end: Date } => {
  const yesterday = getYesterday();
  const today = new Date();

  switch (preset) {
    case 'today':
      return {
        start: today,
        end: today,
      };

    case 'current-month':
      return {
        start: startOfMonth(today),
        end: today,
      };

    case 'previous-month':
      return {
        start: startOfMonth(subMonths(today, 1)),
        end: endOfMonth(subMonths(today, 1)),
      };

    case 'accumulated':
      return {
        start: startOfYear(today),
        end: today,
      };

    case 'last-30-days':
      return {
        start: subDays(today, 29),
        end: today,
      };

    case 'last-6-months':
      return {
        start: subMonths(today, 6),
        end: today,
      };

    case 'last-12-months':
      return {
        start: subMonths(today, 12),
        end: today,
      };

    default:
      if (typeof preset === 'number') {
        return {
          start: startOfYear(new Date(preset, 0, 1)),
          end: endOfYear(new Date(preset, 11, 31)),
        };
      }

      return {
        start: startOfMonth(yesterday),
        end: yesterday,
      };
  }
};

/**
 * Gets available years for selection (only closed complete years)
 */
export const getAvailableYears = (): number[] => {
  const yesterday = getYesterday();
  const currentYear = getYear(yesterday);
  const minYear = getYear(AVAILABLE_DATA_RANGE.min);

  const years: number[] = [];

  // Only include years before current year (closed complete years)
  for (let year = currentYear - 1; year >= minYear; year--) {
    years.push(year);
  }

  return years;
};
