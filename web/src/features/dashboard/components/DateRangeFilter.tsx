import { useState, useMemo, useEffect } from 'react';
import { SelectItem, SelectSection } from '@heroui/react';
import { AppSelect } from '@/core/components/AppSelect';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { useDateRange } from '@/core/hooks/useDateRange';
import { getAvailableYears } from '@/core/utils/dateRangePresets';
import type { DateRangePreset } from '@/core/config/dateRangeConfig';
import { PRESET_LABELS } from '@/core/config/dateRangeConfig';
import { useAuthStore } from '@/core/store/authStore';
import { getAllowedPresets, getAllowedYears } from '@/core/config/access';
import { CustomDateRangePicker } from './CustomDateRangePicker';

interface PresetOption {
  value: string;
  label: string;
}

export function DateRangeFilter() {
  const { preset, setPreset } = useDateRange();
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);

  // Role-based gating of temporality presets and years.
  const dynaRole = useAuthStore((s) => s.user?.dynaRole);
  const allowedPresets = getAllowedPresets(dynaRole);
  const allowedYears = getAllowedYears(dynaRole);
  const presetAllowed = (value: string) =>
    allowedPresets === 'all' || allowedPresets.includes(value as DateRangePreset);
  const showCustom = allowedPresets === 'all';

  const mainPresets: PresetOption[] = [
    { value: 'previous-month', label: PRESET_LABELS['previous-month'] },
    { value: 'accumulated', label: PRESET_LABELS['accumulated'] },
    { value: 'current-month', label: PRESET_LABELS['current-month'] },
    { value: 'today', label: PRESET_LABELS['today'] },
  ].filter((option) => presetAllowed(option.value));

  const periodPresets: PresetOption[] = [
    { value: 'last-30-days', label: PRESET_LABELS['last-30-days'] },
    { value: 'last-6-months', label: PRESET_LABELS['last-6-months'] },
    { value: 'last-12-months', label: PRESET_LABELS['last-12-months'] },
  ].filter((option) => presetAllowed(option.value));

  // Add available years (only closed complete years) allowed for this role
  const availableYears = getAvailableYears().filter(
    (year) => allowedYears === 'all' || allowedYears.includes(year),
  );
  const yearOptions: PresetOption[] = availableYears.map((year) => ({
    value: year.toString(),
    label: year.toString(),
  }));

  // If the persisted selection is not allowed for this role, fall back to a
  // valid one so the selector never shows an out-of-scope period.
  useEffect(() => {
    const isYear = typeof preset === 'number';
    const isValid = isYear
      ? allowedYears === 'all' || allowedYears.includes(preset as number)
      : preset === 'custom'
        ? showCustom
        : presetAllowed(String(preset));
    if (isValid) return;
    const fallback = mainPresets[0]?.value ?? periodPresets[0]?.value ?? availableYears[0]?.toString();
    if (!fallback) return;
    if (!isNaN(Number(fallback))) setPreset(Number(fallback));
    else setPreset(fallback as DateRangePreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynaRole]);

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
      <AppSelect
        label="Temporalidad"
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

        {periodPresets.length > 0 ? (
          <SelectSection title="Períodos" showDivider>
            {periodPresets.map((option) => (
              <SelectItem key={option.value} className="!cursor-pointer" style={{ cursor: 'pointer' }}>
                {option.label}
              </SelectItem>
            ))}
          </SelectSection>
        ) : null}

        {showCustom ? (
          <SelectSection>
            <SelectItem key="custom" className="!cursor-pointer" style={{ cursor: 'pointer' }}>
              Rango personalizado...
            </SelectItem>
          </SelectSection>
        ) : null}
      </AppSelect>

      <CustomDateRangePicker
        isOpen={isCustomPickerOpen}
        onClose={() => setIsCustomPickerOpen(false)}
      />
    </>
  );
}
