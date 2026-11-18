import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = path.join(repo, 'test-results/auth-native-spike-20261118')
const run = path.join(base, 'run-' + new Date().toISOString().replaceAll(/[:.]/g, '-'))
const versions = { go: '1.27.4', auth: '2.198.0' }
const goSha = '178ab98950ac69ab25069307dc6ade79f3816e414cce95b4da166a115cde1e7e'
const deadline = Date.now() + 60 * 60 * 1000
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
if (process.argv.includes('--plan')) {
  console.log(JSON.stringify({ versions, directory: run, minutes: 60, database: false, serverStartup: false, systemPathChanges: false, services: false }, null, 2))
  process.exit(0)
}
if (process.platform !== 'win32') throw new Error('This spike targets Windows only')
fs.mkdirSync(run, { recursive: true })
if (!fs.realpathSync(run).toLowerCase().startsWith(fs.realpathSync(repo).toLowerCase() + path.sep)) throw new Error('Spike directory resolves outside repository')
const winBin = path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32')
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => ['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'USERPROFILE', 'TEMP', 'TMP', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY'].includes(key.toUpperCase())))
for (const name of ['TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA']) {
  environment[name] = path.join(run, 'runtime-' + name.toLowerCase())
  fs.mkdirSync(environment[name])
}
const result = { status: 'running', startedAt: new Date().toISOString(), versions, directory: run, databaseConnected: false, healthVerified: false, loginVerified: false }
function command(exe, args, label, cwd = run) {
  if (Date.now() >= deadline) throw new Error('Approved one-hour limit expired')
  console.log('Running ' + label)
  return new Promise((resolve, reject) => {
    const stdout = fs.openSync(path.join(run, label + '.stdout.log'), 'w')
    const stderr = fs.openSync(path.join(run, label + '.stderr.log'), 'w')
    const child = spawn(exe, args, { cwd, env: environment, windowsHide: true, stdio: ['ignore', stdout, stderr] })
    fs.closeSync(stdout); fs.closeSync(stderr)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      // Only this owned command and its download/compiler children are terminated.
      const kill = child.pid ? spawnSync(path.join(winBin, 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 }) : null
      result.timeoutCleanup = { pid: child.pid, confirmed: kill?.status === 0 }
      if (kill?.status !== 0) child.kill()
      child.unref()
      reject(new Error(label + ': time limit; process-tree cleanup ' + (kill?.status === 0 ? 'confirmed' : 'UNCONFIRMED, inspect recorded PID'))) 
    }, Math.max(1, deadline - Date.now() - 6000))
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('close', code => {
      clearTimeout(timer)
      if (timedOut || code !== 0) reject(new Error(`${label}: ${timedOut ? 'time limit' : 'exit ' + code}; see ${label}.stderr.log`))
      else resolve()
    })
  })
}
async function extract(zip, prefix, label) {
  await command(path.join(winBin, 'tar.exe'), ['-tf', zip], label + '-list')
  await command(path.join(winBin, 'tar.exe'), ['-tvf', zip], label + '-types')
  const types = fs.readFileSync(path.join(run, label + '-types.stdout.log'), 'utf8').trim().split(/\r?\n/)
  if (types.some(line => !/^[-d][rwxstST-]{9}\s/.test(line) || line.includes(' link to ') || line.includes(' -> '))) throw new Error('Archive links or unsupported entry types refused')
  const entries = fs.readFileSync(path.join(run, label + '-list.stdout.log'), 'utf8').trim().split(/\r?\n/)
  if (types.length !== entries.length) throw new Error('Archive listing mismatch')
  for (const entry of entries) {
    const normalized = entry.replaceAll('\\', '/')
    if (!normalized.startsWith(prefix + '/') || normalized.split('/').includes('..') || normalized.includes(':')) throw new Error('Unexpected archive path: ' + entry)
  }
  await command(path.join(winBin, 'tar.exe'), ['-xf', zip, '-C', run], label + '-extract')
}
function sourceDigest(dir) {
  const hash = crypto.createHash('sha256')
  function visit(current) {
    for (const name of fs.readdirSync(current).sort()) {
      const file = path.join(current, name)
      const stat = fs.lstatSync(file)
      if (stat.isSymbolicLink()) hash.update(path.relative(dir, file) + ':' + fs.readlinkSync(file))
      else if (stat.isDirectory()) visit(file)
      else hash.update(path.relative(dir, file) + ':' + sha(file))
    }
  }
  visit(dir)
  return hash.digest('hex')
}
try {
  const curl = path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/curl.exe')
  const flags = ['--disable', '--fail', '--location', '--silent', '--show-error', '--connect-timeout', '15', '--max-time', '600']
  await command(curl, [...flags, `https://dl.google.com/go/go${versions.go}.windows-amd64.zip`, '--output', 'go.zip'], 'download-go')
  result.goSha256 = sha(path.join(run, 'go.zip'))
  if (result.goSha256 !== goSha) throw new Error('Official Go archive SHA-256 mismatch; execution refused')
  await command(curl, [...flags, `https://codeload.github.com/supabase/auth/zip/refs/tags/v${versions.auth}`, '--output', 'auth.zip'], 'download-auth')
  result.authArchiveSha256 = sha(path.join(run, 'auth.zip'))
  await extract(path.join(run, 'go.zip'), 'go', 'go')
  await extract(path.join(run, 'auth.zip'), 'auth-' + versions.auth, 'auth')
  const source = path.join(run, 'auth-' + versions.auth)
  if (!/^go 1\.27\.4\s*$/m.test(fs.readFileSync(path.join(source, 'go.mod'), 'utf8'))) throw new Error('Unexpected Auth Go requirement')
  const before = sourceDigest(source)
  Object.assign(environment, {
    GOROOT: path.join(run, 'go'), GOPATH: path.join(run, 'gopath'), GOMODCACHE: path.join(run, 'modules'), GOCACHE: path.join(run, 'build-cache'), GOTMPDIR: path.join(run, 'tmp'),
    GOENV: 'off', GOTOOLCHAIN: 'local', GOWORK: 'off', GOPROXY: 'https://proxy.golang.org', GOSUMDB: 'sum.golang.org', GOPRIVATE: '', GONOPROXY: '', GONOSUMDB: '', GOINSECURE: '',
    GOFLAGS: '-mod=readonly', CGO_ENABLED: '0', GOOS: 'windows', GOARCH: 'amd64', GOTELEMETRY: 'off',
  })
  fs.mkdirSync(environment.GOTMPDIR)
  const go = path.join(run, 'go/bin/go.exe')
  await command(go, ['version'], 'go-version', source)
  await command(go, ['mod', 'download'], 'mod-download', source)
  await command(go, ['mod', 'verify'], 'mod-verify', source)
  result.binary = path.join(run, 'auth.exe')
  await command(go, ['build', '-p', '2', '-buildvcs=false', '-ldflags', '-X github.com/supabase/auth/internal/utilities.Version=v2.198.0', '-o', result.binary, '.'], 'build-auth', source)
  result.sourceUnmodified = before === sourceDigest(source)
  if (!result.sourceUnmodified) throw new Error('Source changed during build; review required')
  result.binarySha256 = sha(result.binary)
  result.status = 'built_only_not_a_ready_environment'
} catch (error) {
  result.status = 'failed'
  result.error = error.message
  console.error(error.message)
  process.exitCode = 1
} finally {
  result.finishedAt = new Date().toISOString()
  fs.writeFileSync(path.join(run, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  fs.writeFileSync(path.join(base, 'last-run.json'), JSON.stringify(result, null, 2) + '\n')
  console.log('Result: ' + result.status + '; logs: ' + run)
}
