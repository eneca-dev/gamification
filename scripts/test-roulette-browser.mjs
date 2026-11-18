import { spawn } from 'node:child_process'
import { startBrowserServer } from './roulette-browser-server.mjs'

// Own the server in this process: Playwright's Windows process-tree teardown can hang.
const server = await startBrowserServer()
let exitCode = 1
try {
  exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.browser.config.ts', ...process.argv.slice(2)], {
      stdio: 'inherit', env: { ...process.env, QA_LOCAL_BROWSER_MANAGED: 'true' },
    })
    child.once('error', reject)
    child.once('exit', code => resolve(code ?? 1))
  })
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
process.exitCode = exitCode
