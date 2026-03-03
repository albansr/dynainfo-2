import { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input } from '@heroui/react';
import { useDateRange } from '@/core/hooks/useDateRange';
import { AVAILABLE_DATA_RANGE } from '@/core/config/dateRangeConfig';
import { format } from 'date-fns';

interface CustomDateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatDateInput = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
};

const parseDateInput = (value: string): Date | null => {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getDate() !== Number(day) || date.getMonth() !== Number(month) - 1) return null;
  return date;
};

export function CustomDateRangePicker({ isOpen, onClose }: CustomDateRangePickerProps) {
  const { startDate, setCustomRange } = useDateRange();

  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTempStart(format(startDate, 'dd-MM-yyyy'));
      setTempEnd(format(new Date(), 'dd-MM-yyyy'));
      setError(null);
    }
  }, [isOpen, startDate]);

  const handleApply = () => {
    const startDateObj = parseDateInput(tempStart);
    const endDateObj = parseDateInput(tempEnd);

    if (!startDateObj || !endDateObj) {
      setError('Formato inválido. Usa dd-MM-yyyy');
      return;
    }

    if (startDateObj < AVAILABLE_DATA_RANGE.min || endDateObj > AVAILABLE_DATA_RANGE.max) {
      setError(`El rango debe estar entre ${format(AVAILABLE_DATA_RANGE.min, 'dd/MM/yyyy')} y ${format(AVAILABLE_DATA_RANGE.max, 'dd/MM/yyyy')}`);
      return;
    }

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
            <Input
              label="Fecha de inicio"
              placeholder="dd-MM-yyyy"
              value={tempStart}
              onValueChange={(v) => setTempStart(formatDateInput(v))}
              maxLength={10}
            />
            <Input
              label="Fecha final"
              placeholder="dd-MM-yyyy"
              value={tempEnd}
              onValueChange={(v) => setTempEnd(formatDateInput(v))}
              maxLength={10}
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
