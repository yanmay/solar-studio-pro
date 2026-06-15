import { test } from '@playwright/test';

test('capture screenshot', async ({ page }) => {
  console.log("Navigating to http://localhost:8080...");
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(3000); // Wait for animations
  console.log("Taking screenshot of landing page...");
  await page.screenshot({ path: 'C:/Users/noobg/.gemini/antigravity-ide/brain/5d57b788-6d11-4fe6-922c-45eb81c205a3/scratch/landing.png' });
});
