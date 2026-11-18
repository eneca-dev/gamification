import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import tailwind from '@tailwindcss/postcss'

export async function startBrowserServer() {
  const root = path.resolve('tests/browser')
  const output = path.resolve('test-results/roulette-browser-dist')
  const actions = path.join(root, 'fixture-actions.ts').replaceAll('\\', '/')
  await build({
    root, configFile: false, envDir: false, publicDir: false,
    resolve: { alias: [
      { find: /^@\/modules\/cache$/, replacement: path.join(root, 'cache-entry.ts') },
      { find: '@/modules/shop/index.client', replacement: actions },
      { find: '@', replacement: path.resolve('src') },
    ] },
    plugins: [{
      name: 'isolated-roulette-boundaries',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === './actions' && importer?.replaceAll('\\', '/').endsWith('/roulette/hooks.ts')) return actions
        if (/supabase|server-only|next\/headers|next\/cache/.test(source)) throw new Error('External/server module forbidden in isolated QA: ' + source)
      },
      async load(id) {
        const normalized = id.replaceAll('\\', '/')
        if (/\/src\/(?:lib\/supabase|modules\/roulette\/actions\.|modules\/cache\/providers\/|modules\/cache\/realtime\/)/.test(normalized)) throw new Error('Forbidden server dependency: ' + normalized)
        if (id.replaceAll('\\', '/').endsWith('/src/app/globals.css')) {
          // Preserve real styles while removing the Google Fonts network dependency.
          return (await fs.readFile(id, 'utf8')).replace(/^@import url\([^\n]+\);\r?\n/gm, '')
        }
      },
    }],
    css: { postcss: { plugins: [tailwind()] } },
    build: { outDir: output, emptyOutDir: true, sourcemap: false,
      rolldownOptions: { onwarn(warning, warn) { if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning) } },
    },
  })

  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (req.headers.host !== '127.0.0.1:4179' || req.method !== 'GET') { res.writeHead(403); res.end(); return }
    const pathname = new URL(req.url, 'http://127.0.0.1:4179').pathname
    // Serve only generated public bundle paths, never source, env or arbitrary files.
    if (pathname !== '/' && !/^\/assets\/[a-zA-Z0-9_-]+\.(js|css)$/.test(pathname)) { res.writeHead(404); res.end(); return }
    try {
      const file = path.join(output, pathname === '/' ? 'index.html' : pathname)
      res.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream')
      res.end(await fs.readFile(file))
    } catch { res.writeHead(404); res.end() }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(4179, '127.0.0.1', resolve)
  })
  console.log('Isolated synthetic QA: http://127.0.0.1:4179')
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await startBrowserServer()
