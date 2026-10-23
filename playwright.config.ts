import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:5173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.LLAVE_TEST_SERVERS_MANAGED === '1' ? undefined : [
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: 'node tests/fixtures/configured-server.mjs', url: 'http://127.0.0.1:5180', reuseExistingServer: !process.env.CI },
  ],
})
