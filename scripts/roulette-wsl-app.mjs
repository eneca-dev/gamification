import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import pg from 'pg'

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const output = path.join(repo, 'test-results/wsl-qa')
export const appUrl = 'http://127.0.0.1:3011'
const manifestPath = path.join(output, 'app.local.json')

export function readRuntime() {
  const runtime = JSON.parse(fs.readFileSync(path.join(output, 'runtime.local.json'), 'utf8'))
  const result = JSON.parse(fs.readFileSync(path.join(output, 'last-run.json'), 'utf8'))
  if (result.status !== 'backend_ready_app_e2e_pending' || runtime.marker !== 'isolated-wsl-roulette-qa-v1'
    || runtime.directory !== result.directory || !/^\/var\/tmp\/gamification-roulette-qa-[a-z0-9_]+$/.test(runtime.directory)
    || runtime.baseUrl !== 'http://127.0.0.1:55441' || runtime.database.host !== '127.0.0.1'
    || runtime.database.port !== 55438 || runtime.database.database !== 'roulette_e2e' || runtime.database.user !== 'qa_owner'
    || runtime.users.length !== 2 || !runtime.users.every(user => ['pilot', 'denied'].includes(user.name) && user.email === user.name + '@roulette.example.invalid')) {
    throw new Error('Approved local QA identity mismatch')
  }
  return runtime
}

export async function connectDatabase(runtime) {
  const db = new pg.Client({ ...runtime.database, connectionTimeoutMillis: 5000, statement_timeout: 15000 })
  await db.connect()
  try {
    const { rows: [row] } = await db.query("select current_database() as name,current_setting('data_directory') as directory, (select marker from qa_guard.environment) as marker")
    if (row.name !== 'roulette_e2e' || row.directory !== runtime.directory + '/pg-data' || row.marker !== runtime.marker) throw new Error('Connected cluster is not the owned QA cluster')
    return db
  } catch (error) { await db.end(); throw error }
}

export function readApp() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const directory = path.resolve(manifest.directory)
  if (!directory.startsWith(output + path.sep + 'app-') || !fs.realpathSync(directory).startsWith(fs.realpathSync(output) + path.sep)) throw new Error('QA app directory escaped workspace')
  if (manifest.backendDirectory !== readRuntime().directory) throw new Error('App belongs to an earlier QA backend')
  return manifest
}

function environment(runtime, manifest) {
  const allowed = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA'])
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toUpperCase())))
  return { ...env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: '--require=' + JSON.stringify(path.join(repo, 'scripts/roulette-qa-network.cjs')),
    NEXT_PUBLIC_SUPABASE_URL: runtime.baseUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: runtime.anonKey,
    SUPABASE_SECRET_KEY: runtime.serviceKey, ROULETTE_CONFIRMATION_SECRET: manifest.confirmationSecret,
    ROULETTE_PILOT_EMAIL: runtime.users.find(user => user.name === 'pilot').email,
    ENABLE_DEV_TOOLS: 'false', BIMO_V2_ENABLED: 'false', QA_ISOLATED_WSL: 'true',
    QA_FIXTURE_USERS: JSON.stringify(runtime.users), WORKSECTION_CLIENT_ID: 'qa-disabled', WORKSECTION_CLIENT_SECRET: 'qa-disabled',
    WORKSECTION_REDIRECT_URI: appUrl + '/signin-worksection', NEXT_PUBLIC_SITE_URL: appUrl }
}

const loginPage = `export default function QaLogin() {
  return <main style={{ padding: 32 }}><h1>Локальная приёмка рулетки</h1>
    <p>Синтетические аккаунты. Вход через настоящий локальный Auth; Worksection не подключён.</p>
    <form action="/api/auth/qa" method="post"><button name="account" value="pilot">Войти тестовым игроком</button></form>
    <form action="/api/auth/qa" method="post"><button name="account" value="denied">Войти без допуска к рулетке</button></form>
  </main>
}
`
const loginRoute = `import { createSupabaseServerClient } from '@/config/supabase'
export async function POST(request: Request) {
  if (process.env.QA_ISOLATED_WSL !== 'true' || process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:55441') return new Response(null, { status: 404 })
  const data = await request.formData()
  const users = JSON.parse(process.env.QA_FIXTURE_USERS!) as { name: string; email: string; password: string }[]
  const user = users.find(user => user.name === data.get('account'))
  if (!user) return new Response('Unknown synthetic account', { status: 400 })
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: user.password })
  if (error) return new Response('Local Auth sign-in failed', { status: 401 })
  return new Response(null, { status: 303, headers: { Location: '/store?tab=roulette' } })
}
`

async function prepare(runtime) {
  const db = await connectDatabase(runtime)
  try {
    // Only the read needed by the shared shell; other day-off features are outside acceptance.
    await db.query(`create table if not exists public.day_off_requests (
      id uuid primary key default gen_random_uuid(), ws_user_id uuid not null references public.ws_users(id), resolved_at timestamptz
    ); alter table public.day_off_requests enable row level security;
    grant select on public.day_off_requests to service_role;`)
    // Catalog navigation reads this relation even when the Bimo tab is disabled.
    // Empty synthetic catalog only; no historical integration migrations are replayed.
    await db.query(`create table if not exists public.bimo_catalog (
      asset_key text primary key,
      slot text not null check (slot in ('outfit', 'accessory', 'background')),
      product_id uuid not null unique references public.shop_products(id) on delete restrict,
      is_released boolean not null default false, created_at timestamptz not null default now(),
      constraint bimo_catalog_key_format check (asset_key ~ '^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$'),
      constraint bimo_catalog_key_slot check (split_part(asset_key, '.', 1) = slot),
      unique (asset_key, slot)
    ); alter table public.bimo_catalog enable row level security;
    revoke all on public.bimo_catalog from public, anon, authenticated;
    grant select on public.bimo_catalog to service_role;`)
    await db.query(fs.readFileSync(path.join(repo, 'tests/integration/fixtures/wsl-dashboard.sql'), 'utf8'))
    const toursDirectory = path.join(repo, 'src/modules/onboarding/tours')
    const tours = fs.readdirSync(toursDirectory).filter(name => /\.tsx?$/.test(name)).map(name => fs.readFileSync(path.join(toursDirectory, name), 'utf8')).join('\n')
    const slugs = [...tours.matchAll(/pageSlug:\s*'([^']+)'/g)].map(match => match[1])
    if (!slugs.length) throw new Error('Onboarding fixture slugs not found')
    await db.query('update public.profiles set onboarding_seen=$1 where user_id=any($2::uuid[])', [slugs, runtime.users.map(user => user.authId)])
    await db.query("notify pgrst, 'reload schema'")
  } finally { await db.end() }
  const directory = fs.mkdtempSync(path.join(output, 'app-'))
  for (const name of ['src', 'public']) fs.cpSync(path.join(repo, name), path.join(directory, name), { recursive: true,
    filter: source => { if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Unexpected source symlink'); return true } })
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs']) fs.copyFileSync(path.join(repo, name), path.join(directory, name))
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(directory, 'node_modules'), 'junction')
  fs.mkdirSync(path.join(directory, 'src/app/api/auth/qa'), { recursive: true })
  fs.writeFileSync(path.join(directory, 'src/app/api/auth/qa/route.ts'), loginRoute)
  fs.writeFileSync(path.join(directory, 'src/app/login/page.tsx'), loginPage)
  // Browser also cannot contact external APIs/assets in this acceptance copy.
  const config = fs.readFileSync(path.join(directory, 'next.config.ts'), 'utf8')
  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:55441 ws://127.0.0.1:55441; form-action 'self'; frame-ancestors 'none'"
  fs.writeFileSync(path.join(directory, 'next.config.ts'), config.replace('export default nextConfig;', `nextConfig.headers = async () => [{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: ${JSON.stringify(csp)} }] }];\nexport default nextConfig;`))
  const manifest = { directory, backendDirectory: runtime.directory, confirmationSecret: crypto.randomBytes(32).toString('hex'), built: false }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  return manifest
}

async function run(command) {
  const runtime = readRuntime()
  const manifest = command === 'build' ? await prepare(runtime) : readApp()
  if (command !== 'build' && !manifest.built) throw new Error('No verified production build')
  const args = command === 'build' ? ['build', '--webpack'] : ['start', '-H', '127.0.0.1', '-p', '3011']
  const log = fs.openSync(path.join(output, 'app-' + command + '.log'), 'w')
  const child = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), ...args], {
    cwd: manifest.directory, env: environment(runtime, manifest), windowsHide: true, stdio: ['ignore', log, log],
  })
  fs.closeSync(log)
  console.log('QA app ' + command + '; pid=' + child.pid + '; log=test-results/wsl-qa/app-' + command + '.log')
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) })
  if (code !== 0) throw new Error('QA app ' + command + ' failed: ' + code + '; inspect local log')
  if (command === 'build') {
    manifest.built = true
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    console.log('Isolated production build passed')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!['build', 'start'].includes(process.argv[2])) throw new Error('Use build or start')
  await run(process.argv[2])
}
