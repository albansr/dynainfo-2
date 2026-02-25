import { useState, useMemo } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, DatePicker } from '@heroui/react';
import { parseDate, CalendarDate } from '@internationalized/date';
import { useDateRange } from '@/core/hooks/useDateRange';
import { AVAILABLE_DATA_RANGE } from '@/core/config/dateRangeConfig';
import { format } from 'date-fns';

interface CustomDateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to convert Date to CalendarDate
const toCalendarDate = (date: Date): CalendarDate => {
  return parseDate(format(date, 'yyyy-MM-dd'));
};

export function CustomDateRangePicker({ isOpen, onClose }: CustomDateRangePickerProps) {
  const { startDate, endDate, setCustomRange } = useDateRange();

  // Memoize min/max dates (calculated once)
  const minDate = useMemo(() => toCalendarDate(AVAILABLE_DATA_RANGE.min), []);
  const maxDate = useMemo(() => toCalendarDate(AVAILABLE_DATA_RANGE.max), []);

  const [tempStart, setTempStart] = useState<CalendarDate | null>(toCalendarDate(startDate));
  const [tempEnd, setTempEnd] = useState<CalendarDate | null>(toCalendarDate(endDate));
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    if (!tempStart || !tempEnd) {
      setError('Debes seleccionar ambas fechas');
      return;
    }

    const startDateObj = new Date(tempStart.year, tempStart.month - 1, tempStart.day);
    const endDateObj = new Date(tempEnd.year, tempEnd.month - 1, tempEnd.day);

    // Validate range is within available data range
    if (startDateObj < AVAILABLE_DATA_RANGE.min || endDateObj > AVAILABLE_DATA_RANGE.max) {
      setError(`El rango debe estar entre ${format(AVAILABLE_DATA_RANGE.min, 'dd/MM/yyyy')} y ${format(AVAILABLE_DATA_RANGE.max, 'dd/MM/yyyy')}`);
      return;
    }

    // Validate start is before end
    if (startDateObj > endDateObj) {
      setError('La fecha de inicio debe ser anterior a la fecha final');
      return;
    }

    setCustomRange(startDateObj, endDateObj);
    setError(null);
    onClose();
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalContent>
        <ModalHeader>
          <h3 className="text-lg font-semibold">Rango Personalizado</h3>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <DatePicker
              label="Fecha de inicio"
              value={tempStart}
              onChange={setTempStart}
              minValue={minDate}
              maxValue={maxDate}
            />
            <DatePicker
              label="Fecha final"
              value={tempEnd}
              onChange={setTempEnd}
              minValue={minDate}
              maxValue={maxDate}
            />
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="default" variant="light" onPress={handleClose}>
            Cancelar
          </Button>
          <Button color="primary" onPress={handleApply}>
            Aplicar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
