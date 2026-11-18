import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    coverage: { provider: 'v8', include: ['src/modules/roulette/**', 'src/modules/cache/utils/**', 'src/modules/cache/hooks/use-cache-mutation.ts', 'src/modules/shop/balance.ts'] },
  },
})
