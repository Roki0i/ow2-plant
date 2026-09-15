import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  testDir: './e2e', fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5173/ow2-plant/', trace: 'retain-on-failure' },
  webServer: { command: 'npm run build -- --base=/ow2-plant/ && npm run preview -- --host 127.0.0.1 --port 5173 --base=/ow2-plant/', url: 'http://127.0.0.1:5173/ow2-plant/', reuseExistingServer: false },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', testMatch: ['**/quality.spec.ts', '**/heroes.spec.ts'], use: { ...devices['iPhone 13'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
