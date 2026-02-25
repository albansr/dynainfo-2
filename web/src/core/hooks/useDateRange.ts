import { useDateRangeStore } from '../store/dateRangeStore';
import { formatDateRangeLabel } from '../utils/formatDateRangeLabel';

/**
 * Hook to consume date range from store
 *
 * @returns {object} Date range state with formatted label
 */
export const useDateRange = () => {
  const startDate = useDateRangeStore((state) => state.startDate);
  const endDate = useDateRangeStore((state) => state.endDate);
  const preset = useDateRangeStore((state) => state.preset);
  const setPreset = useDateRangeStore((state) => state.setPreset);
  const setCustomRange = useDateRangeStore((state) => state.setCustomRange);

  const formattedRange = formatDateRangeLabel(startDate, endDate);

  return {
    startDate,
    endDate,
    preset,
    formattedRange,
    setPreset,
    setCustomRange,
  };
};
