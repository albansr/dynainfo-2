import { useState, useMemo } from 'react';
import { Select, SelectItem, SelectSection } from '@heroui/react';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { useDateRange } from '@/core/hooks/useDateRange';
import { getAvailableYears } from '@/core/utils/dateRangePresets';
import type { DateRangePreset } from '@/core/config/dateRangeConfig';
import { CustomDateRangePicker } from './CustomDateRangePicker';

interface PresetOption {
  value: string;
  label: string;
}

export function DateRangeFilter() {
  const { preset, setPreset } = useDateRange();
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);

  // Generate preset options
  const presetOptions: PresetOption[] = [
    { value: 'current-month', label: 'Mes en curso' },
    { value: 'accumulated', label: 'Acumulado' },
    { value: 'last-30-days', label: 'Últimos 30 días' },
    { value: 'last-6-months', label: 'Últimos 6 meses' },
    { value: 'last-12-months', label: 'Últimos 12 meses' },
  ];

  // Add available years (only closed complete years)
  const availableYears = getAvailableYears();
  const yearOptions: PresetOption[] = availableYears.map((year) => ({
    value: year.toString(),
    label: year.toString(),
  }));

  const handleSelectionChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomPickerOpen(true);
    } else if (!isNaN(Number(value))) {
      // It's a year
      setPreset(Number(value));
    } else {
      // It's a preset
      setPreset(value as DateRangePreset);
    }
  };

  // Memoize selectedKeys to prevent unnecessary re-renders
  const selectedKeys = useMemo(() => [preset.toString()], [preset]);

  return (
    <>
      <Select
        label="Período"
        variant="bordered"
        placeholder="Selecciona un período"
        selectedKeys={selectedKeys}
        onSelectionChange={(keys) => {
          const value = Array.from(keys)[0] as string;
          if (value) handleSelectionChange(value);
        }}
        className="w-full"
        classNames={{
          trigger: 'cursor-pointer !border',
        }}
        popoverProps={{
          classNames: {
            content: 'cursor-pointer z-50',
          },
        }}
        listboxProps={{
          itemClasses: {
            base: 'cursor-pointer',
          },
        }}
        startContent={<CalendarIcon className="h-4 w-4 text-default-400" />}
      >
        <SelectSection title="Períodos" showDivider>
          {presetOptions.map((option) => (
            <SelectItem key={option.value} value={option.value} className="!cursor-pointer" style={{ cursor: 'pointer' }}>
              {option.label}
            </SelectItem>
          ))}
        </SelectSection>

        {yearOptions.length > 0 && (
          <SelectSection title="Años" showDivider>
            {yearOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="!cursor-pointer" style={{ cursor: 'pointer' }}>
                {option.label}
              </SelectItem>
            ))}
          </SelectSection>
        )}

        <SelectSection>
          <SelectItem key="custom" value="custom" className="!cursor-pointer" style={{ cursor: 'pointer' }}>
            Rango personalizado...
          </SelectItem>
        </SelectSection>
      </Select>

      <CustomDateRangePicker
        isOpen={isCustomPickerOpen}
        onClose={() => setIsCustomPickerOpen(false)}
      />
    </>
  );
}
