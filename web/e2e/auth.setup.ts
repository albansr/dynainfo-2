import { test as setup, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AUTH_FILE = 'e2e/.auth/state.json';
const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Authenticate once via the Dyna SSO test token (reuses api/generate-test-token.cjs
 * so the secret isn't duplicated), then persist the session for the other specs.
 * The SSO endpoint is hit through the web origin (:4000 proxy) so the cookie is
 * scoped to the app; it 302-redirects to /dashboard on success.
 */
setup('authenticate via Dyna SSO test token', async ({ page }) => {
  const out = execSync('node generate-test-token.cjs', {
    cwd: path.resolve(HERE, '../../api'),
    encoding: 'utf8',
  });
  const token = out.match(/token=([\w.-]+)/)?.[1];
  if (!token) throw new Error('Could not extract the SSO test token from generate-test-token.cjs');

  // Hit the API directly (:5002) — the web dev server's /api proxy can't reach
  // the api from inside its container. The api sets the session cookie (scoped
  // to localhost, same-site with :4000) and 302-redirects to the app.
  await page.goto(`http://localhost:5002/api/auth/sso/dyna-login?token=${token}`);
  await page.waitForURL('**/dashboard**');
  await expect(page.getByRole('heading', { name: 'Análisis', exact: true })).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
