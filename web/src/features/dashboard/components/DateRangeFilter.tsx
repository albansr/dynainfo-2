import { useState, useMemo } from 'react';
import { Select, SelectItem, SelectSection } from '@heroui/react';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { useDateRange } from '@/core/hooks/useDateRange';
import { getAvailableYears } from '@/core/utils/dateRangePresets';
import type { DateRangePreset } from '@/core/config/dateRangeConfig';
import { PRESET_LABELS } from '@/core/config/dateRangeConfig';
import { CustomDateRangePicker } from './CustomDateRangePicker';

interface PresetOption {
  value: string;
  label: string;
}

export function DateRangeFilter() {
  const { preset, setPreset } = useDateRange();
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);

  const mainPresets: PresetOption[] = [
    { value: 'previous-month', label: PRESET_LABELS['previous-month'] },
    { value: 'accumulated', label: PRESET_LABELS['accumulated'] },
    { value: 'current-month', label: PRESET_LABELS['current-month'] },
    { value: 'today', label: PRESET_LABELS['today'] },
  ];

  const periodPresets: PresetOption[] = [
    { value: 'last-30-days', label: PRESET_LABELS['last-30-days'] },
    { value: 'last-6-months', label: PRESET_LABELS['last-6-months'] },
    { value: 'last-12-months', label: PRESET_LABELS['last-12-months'] },
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
        label="Temporalidad"
        variant="bordered"
        placeholder="Selecciona una temporalidad"
        disallowEmptySelection={false}
        selectedKeys={selectedKeys}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys);
          if (selected.length === 0 && preset === 'custom') {
            setIsCustomPickerOpen(true);
            return;
          }
          const value = selected[0] as string;
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
        <SelectSection title="Temporalidades" showDivider>
          {mainPresets.map((option) => (
            <SelectItem key={option.value} className="!cursor-pointer" style={{ cursor: 'pointer' }}>
              {option.label}
            </SelectItem>
          ))}
        </SelectSection>

        {yearOptions.length > 0 ? (
          <SelectSection title="Años" showDivider>
            {yearOptions.map((option) => (
              <SelectItem key={option.value} className="!cursor-pointer" style={{ cursor: 'pointer' }}>
                {option.label}
              </SelectItem>
            ))}
          </SelectSection>
        ) : null}

        <SelectSection title="Períodos" showDivider>
          {periodPresets.map((option) => (
            <SelectItem key={option.value} className="!cursor-pointer" style={{ cursor: 'pointer' }}>
              {option.label}
            </SelectItem>
          ))}
        </SelectSection>

        <SelectSection>
          <SelectItem key="custom" className="!cursor-pointer" style={{ cursor: 'pointer' }}>
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
