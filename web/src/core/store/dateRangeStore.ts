import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DateRangePreset } from '../config/dateRangeConfig';
import { calculatePresetRange } from '../utils/dateRangePresets';

interface DateRangeState {
  startDate: Date;
  endDate: Date;
  preset: DateRangePreset | 'custom';
}

interface DateRangeActions {
  setPreset: (preset: DateRangePreset) => void;
  setCustomRange: (start: Date, end: Date) => void;
}

type DateRangeStore = DateRangeState & DateRangeActions;

// Initialize with 2025 as default
const defaultRange = calculatePresetRange(2025);

const initialState: DateRangeState = {
  startDate: defaultRange.start,
  endDate: defaultRange.end,
  preset: 2025,
};

export const useDateRangeStore = create<DateRangeStore>()(
  persist(
    (set) => ({
      ...initialState,

      setPreset: (preset) => {
        const range = calculatePresetRange(preset);
        set({
          startDate: range.start,
          endDate: range.end,
          preset,
        });
      },

      setCustomRange: (start, end) => {
        set({
          startDate: start,
          endDate: end,
          preset: 'custom',
        });
      },
    }),
    {
      name: 'date-range-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preset: state.preset,
        ...(state.preset === 'custom' && {
          startDate: state.startDate.toISOString(),
          endDate: state.endDate.toISOString(),
        }),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.preset === 'custom') {
          // Restore persisted custom dates (stored as ISO strings by partialize)
          state.startDate = new Date(state.startDate);
          state.endDate = new Date(state.endDate);
        } else {
          const range = calculatePresetRange(state.preset);
          state.startDate = range.start;
          state.endDate = range.end;
        }
      },
    }
  )
);
