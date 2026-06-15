import { config } from 'dotenv';
config({ path: '.env.local' });

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/test',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
