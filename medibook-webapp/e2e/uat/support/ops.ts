import { expect, type Page } from '@playwright/test';

import { escapeRegExp, isCall, selectFirstReal, toast } from './ui.ts';

/**
 * Operations-console flows more than one role script walks through (the
 * owner in O-9, the compliance officer in P-3).
 */

/**
 * Compliance › Export on Request for a patient account (the tab must be open);
 * returns the request number once the request is filed. It is then prepared at
 * once, or left for the nightly run — the toast says which.
 */
export async function fileExportRequest(page: Page, patientEmail: string): Promise<string> {
  await page.getByRole('combobox', { name: 'Subject type' }).selectOption('Patient account');
  // Masked roles find a patient by the exact email only (B2, L-11).
  await page.getByLabel(/^Find patient/).fill(patientEmail);
  await selectFirstReal(page.getByRole('combobox', { name: /^Account/ }), (label) =>
    label.includes(patientEmail),
  );
  const [response] = await Promise.all([
    page.waitForResponse(isCall('POST', /^\/api\/v1\/platform\/compliance\/data-requests$/)),
    page.getByRole('button', { name: 'Prepare Export' }).click(),
  ]);
  expect(response.status(), 'the request is filed').toBe(201);
  const filed = (await response.json()) as { readonly request_no: string };
  await expect(toast(page, new RegExp(`^${escapeRegExp(filed.request_no)}`))).toBeVisible();
  return filed.request_no;
}
