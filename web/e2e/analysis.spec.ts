import { test, expect } from '@playwright/test';

test.describe('Análisis home', () => {
  test('shows the view + temporality selectors and switches view', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Análisis', exact: true })).toBeVisible();
    const viewSelect = page.getByRole('button', { name: /Vista/ });
    await expect(viewSelect).toBeVisible();
    await expect(page.getByRole('button', { name: /Temporalidad/ })).toBeVisible();

    // Switching the view updates the URL (?v=) to the chosen view.
    await viewSelect.click();
    await page.getByRole('option', { name: 'Distribución' }).click();
    await expect(page).toHaveURL(/v=distribucion/);
  });

  test('drills from a table row into the detail explorer', async ({ page }) => {
    await page.goto('/dashboard?v=distribucion');
    const firstRow = page.getByRole('button', { name: /Ver detalle de/i }).first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page).toHaveURL(/\/distribucion\/detalle/);
  });
});
