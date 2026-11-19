import { defineConfig } from '@playwright/test'

const baseURL = process.env.QA_BASE_URL
const projectRef = process.env.QA_PROJECT_REF
if (!baseURL || !projectRef || process.env.QA_ENVIRONMENT_REVIEWED !== 'true') {
  throw new Error('QA_BASE_URL, QA_PROJECT_REF and reviewed isolated environment are required; no automatic server startup')
}
if (projectRef === 'yqezhfughtublpaitmij' || new URL(baseURL).hostname === 'gamification.eneca.by') {
  throw new Error('Production is forbidden for this suite')
}
if (!process.env.QA_STORAGE_STATE) throw new Error('Provide authenticated QA-only storage state')
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL, storageState: process.env.QA_STORAGE_STATE,
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 } } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'desktop-1920', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'wide-2560', use: { viewport: { width: 2560, height: 1440 } } },
  ],
})
