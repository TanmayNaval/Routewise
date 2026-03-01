import { test, expect } from '@playwright/test';

test('trigger trip plan and capture errors quickly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => {
    console.log(`Uncaught exception: ${err.message}`);
    errors.push(`Uncaught exception: ${err.message}`);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Console error: ${msg.text()}`);
      errors.push(`Console error: ${msg.text()}`);
    }
  });

  await page.goto('http://localhost:5173');
  
  await page.getByPlaceholder('e.g., Goa, Bali, Paris').fill('Goa');
  await page.getByPlaceholder('e.g., 5').fill('3');
  await page.getByRole('button', { name: 'Start Journey' }).click();

  // Wait some time to let api resolve and error happen
  await page.waitForTimeout(10000);
  
  console.log("=== CAPTURED BROWSER ERRORS ===");
  errors.forEach(e => console.log(e));
});
