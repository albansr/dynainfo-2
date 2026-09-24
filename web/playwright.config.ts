import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the running dev stack (web :4000 → proxies /api to :5002).
 * `make up` (or `make dev`) must be running. Auth is established once in
 * `e2e/auth.setup.ts` via the Dyna SSO test token and reused via storageState.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/state.json' },
      dependencies: ['setup'],
    },
  ],
});
