import { expect, test } from '@playwright/test';

function encodeScan(data: unknown) {
  const json = JSON.stringify(data);
  const binary = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
  return Buffer.from(binary, 'binary').toString('base64');
}

test('renders a selected multi-roof model and rotates through 360 degrees', async ({ page }) => {
  await page.route('**/api/solar-data**', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      monthly_ghi: [5.2, 5.7, 6.1, 6.4, 6.0, 4.8, 4.2, 4.4, 5.0, 5.5, 5.3, 5.0],
      lat: 19.076,
      lng: 72.877,
      year: 2025,
      ws10m: 3.1,
      t2m: 27,
    }),
  }));
  await page.route('**/api/payment/status**', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ unlocked: true, source: 'db' }),
  }));

  const scan = encodeScan({
    si: {
      address: 'Runtime 3D Roof Test',
      lat: 19.076,
      lng: 72.877,
      roofAreaM2: 140,
      pitchDegrees: 24,
      roofPolygon: [
        {
          type: 'Polygon',
          coordinates: [[
            [72.87694, 19.07596],
            [72.87710, 19.07596],
            [72.87713, 19.07604],
            [72.87704, 19.07610],
            [72.87694, 19.07605],
          ]],
        },
        {
          type: 'Polygon',
          coordinates: [[
            [72.87717, 19.07598],
            [72.87728, 19.07598],
            [72.87728, 19.07607],
            [72.87717, 19.07607],
          ]],
        },
      ],
    },
    pc: {
      tiltAngle: 24,
      setbackM: 0.25,
      walkwayM: 0,
      panelWattage: 450,
      orientation: 'landscape',
      rowAlignment: 'roof_perimeter',
      panelCount: 18,
      systemKwp: 8.1,
      shading: 'none',
    },
    t: { tariffPerKwh: 8 },
  });

  await page.goto(`/results?scan=${encodeURIComponent(scan)}`);

  const preview = page.getByRole('region', { name: 'AR rooftop preview' });
  await expect(preview).toBeVisible({ timeout: 20_000 });
  await expect(preview).toHaveAttribute('data-roof-polygon-count', '2');
  await expect(preview).toHaveAttribute('data-panel-orientation', 'landscape');
  await expect(preview).toHaveAttribute('data-panel-footprint-count', /[1-9]\d*/);

  await page.getByRole('button', { name: 'Open 3D Preview' }).click();
  const canvas = page.locator('canvas').last();
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  const initialFrame = await canvas.screenshot();
  expect(initialFrame.byteLength).toBeGreaterThan(10_000);

  const clockwise = page.getByRole('button', { name: 'Rotate rooftop 45 degrees clockwise' });
  const heading = page.getByRole('status', { name: 'Rooftop heading' });
  for (let index = 0; index < 4; index += 1) await clockwise.click();
  await expect(heading).toHaveAttribute('data-heading', '180');
  const halfTurnFrame = await canvas.screenshot();
  expect(Buffer.compare(initialFrame, halfTurnFrame)).not.toBe(0);
  for (let index = 0; index < 4; index += 1) await clockwise.click();
  await expect(heading).toHaveAttribute('data-heading', '0');

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 12 });
    await page.mouse.up();
  }
  await page.waitForTimeout(500);
  const draggedFrame = await canvas.screenshot();
  expect(Buffer.compare(initialFrame, draggedFrame)).not.toBe(0);
});
