/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/app': path.resolve(__dirname, './src/app'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Unit/component tests only; Playwright specs live in e2e/ and run separately.
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Gate the covered logic layer: policy/config, filter serialization, the
      // api client, and pure formatting/date utils. Thin fetch hooks and UI
      // shells are covered by component/E2E tests, not this unit gate.
      include: [
        'src/core/config/access.ts',
        'src/core/config/drillTarget.ts',
        'src/core/config/analysisViews.ts',
        'src/core/api/downloadExcel.ts',
        'src/core/api/client.ts',
        'src/core/api/hooks/useMergedFilters.ts',
        'src/core/utils/salesMetric.ts',
        'src/core/utils/formatters.ts',
        'src/core/utils/dateRangePresets.ts',
      ],
      exclude: ['**/*.d.ts', '**/*.test.*', '**/types.ts'],
      thresholds: { statements: 80, functions: 80, lines: 80, branches: 70 },
    },
  },
});
