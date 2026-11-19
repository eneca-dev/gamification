import { defineConfig } from '@playwright/test'

if (process.env.QA_LOCAL_BROWSER_MANAGED !== 'true') throw new Error('Run node scripts/test-roulette-browser.mjs to own the isolated server lifecycle')

export default defineConfig({
  testDir: './tests/browser', testMatch: '**/*.spec.ts', fullyParallel: true, workers: 2,
  outputDir: 'test-results/roulette-browser',
  reporter: [['list'], ['json', { outputFile: 'test-results/roulette-browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4179', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure', serviceWorkers: 'block' },
  projects: [360, 768, 1280, 1920, 2560].map(width => ({ name: String(width), use: { viewport: { width, height: width === 360 ? 800 : 1080 } } })),
})
