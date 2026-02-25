import { format } from 'date-fns';

/**
 * Formats date range into user-friendly Spanish label
 */
export const formatDateRangeLabel = (startDate: Date, endDate: Date): string => {
  return `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
};

/**
 * Formats date for display in date picker
 */
export const formatDateForPicker = (date: Date): string => {
  return format(date, 'dd/MM/yyyy');
};
