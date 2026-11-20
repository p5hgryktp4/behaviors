import path from 'node:path'
import {defineConfig, devices} from '@playwright/test'

const PORT = 4173
const repositoryRoot = path.resolve(__dirname, '../..')

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: process.env.CI ? 'retain-on-failure' : 'off',
  },
  webServer: {
    command: 'node tests/browser/server.mjs',
    cwd: repositoryRoot,
    url: `http://127.0.0.1:${PORT}/tests/browser/fixtures/harness.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'firefox', use: {...devices['Desktop Firefox']}},
    {name: 'webkit', use: {...devices['Desktop Safari']}},
  ],
})
