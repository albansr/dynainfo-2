import {
  startOfMonth,
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

  switch (preset) {
    case 'current-month':
      return {
        start: startOfMonth(yesterday),
        end: yesterday,
      };

    case 'accumulated':
      return {
        start: startOfYear(yesterday),
        end: yesterday,
      };

    case 'last-30-days':
      return {
        start: subDays(yesterday, 29),
        end: yesterday,
      };

    case 'last-6-months':
      return {
        start: subMonths(yesterday, 6),
        end: yesterday,
      };

    case 'last-12-months':
      return {
        start: subMonths(yesterday, 12),
        end: yesterday,
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
