import { test, expect } from '@playwright/test';

test('run full flow and take screenshots', async ({ page }) => {
  // Go to map page directly (since we want to test map & results)
  console.log("Navigating to http://localhost:8080/map...");
  await page.goto('http://localhost:8080/map');
  await page.waitForTimeout(2000);

  // Search Mumbai
  console.log("Searching for 'Mumbai'...");
  await page.fill('#location-search', 'Mumbai');
  await page.waitForTimeout(1000);
  
  // Click search button
  await page.click('button:has-text("Search")');
  console.log("Waiting for map flyTo animation...");
  await page.waitForTimeout(4000); // Wait for flight animation & globe fade out

  // Take screenshot of map page after search
  console.log("Taking screenshot of map page after search...");
  await page.screenshot({ path: 'C:/Users/noobg/.gemini/antigravity-ide/brain/5d57b788-6d11-4fe6-922c-45eb81c205a3/scratch/map_searched.png' });

  // Get map container bounding box
  const mapLocator = page.locator('.leaflet-container');
  const box = await mapLocator.boundingBox();
  if (!box) {
    throw new Error("Leaflet map container not found");
  }

  // Draw a polygon (4 points) in Mumbai
  console.log("Drawing outline on the map...");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  
  await page.mouse.click(cx - 80, cy - 80);
  await page.waitForTimeout(300);
  await page.mouse.click(cx + 80, cy - 80);
  await page.waitForTimeout(300);
  await page.mouse.click(cx + 80, cy + 80);
  await page.waitForTimeout(300);
  await page.mouse.click(cx - 80, cy + 80);
  await page.waitForTimeout(300);
  
  // Double-click to finish
  console.log("Double-clicking to finish outline...");
  await page.mouse.dblclick(cx - 80, cy - 80);
  await page.waitForTimeout(2000);

  // Take screenshot of map page with polygon
  console.log("Taking screenshot of map page with polygon...");
  await page.screenshot({ path: 'C:/Users/noobg/.gemini/antigravity-ide/brain/5d57b788-6d11-4fe6-922c-45eb81c205a3/scratch/map_drawn.png' });

  // Click calculate potential button
  console.log("Clicking 'Calculate Potential'...");
  await page.click('button:has-text("Calculate Potential")');
  
  // Wait for loading screen and navigation to results page
  console.log("Waiting for results page...");
  await page.waitForURL('**/results', { timeout: 15000 });
  await page.waitForTimeout(3000); // Let animations run

  // Take screenshot of results page
  console.log("Taking screenshot of results page...");
  await page.screenshot({ path: 'C:/Users/noobg/.gemini/antigravity-ide/brain/5d57b788-6d11-4fe6-922c-45eb81c205a3/scratch/results_page.png' });
  console.log("Done!");
});
