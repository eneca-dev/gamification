import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import pg from 'pg'
const directory = path.resolve('test-results/local-postgres')
const password = fs.readFileSync(path.join(directory, 'password.txt'), 'utf8').trim()
const project = 'localroulettefixture'
const db = new pg.Client({ host: '127.0.0.1', port: 55437, user: 'roulette_local_admin', password, database: 'roulette_qa', connectionTimeoutMillis: 3000 })
const sqlDirectory = 'src/docs-features/roulette/sql'
const artifact = file => fs.readFileSync(path.join(sqlDirectory, file), 'utf8').replace(/^\uFEFF/, '').replaceAll('REPLACE_WITH_APPROVED_QA_PROJECT_REF', project)
const notices = []
db.on('notice', notice => { notices.push(notice.message); console.log(notice.message) })
await db.connect()
try {
  const identity = (await db.query("select current_setting('data_directory') as directory,inet_server_port() as port,current_user as username")).rows[0]
  if (identity.directory.replaceAll('\\', '/') !== path.join(directory, 'data').replaceAll('\\', '/') || identity.port !== 55437 || identity.username !== 'roulette_local_admin') throw new Error('Refusing a different PostgreSQL cluster')
  if (!(await db.query('select exists(select 1 from qa_guard.environment where project_ref=$1 and outbound_reviewed and overrides_approved) as safe', [project])).rows[0].safe) throw new Error('Local fixture marker missing')
  const extensions = (await db.query('select extname from pg_extension')).rows.map(row => row.extname)
  if (extensions.some(name => !['plpgsql', 'pgcrypto'].includes(name))) throw new Error('Unexpected extensions; review before testing')
  if (!(await db.query("select to_regclass('roulette_qa.control') as present")).rows[0].present) await db.query(artifact('03-qa-controls.review.sql'))
  const env = { ...process.env, QA_LOCAL_POSTGRES: 'true', QA_PROJECT_REF: project, QA_ALLOW_DB_MUTATIONS: 'approved', QA_ENVIRONMENT_REVIEWED: 'true',
    QA_PRODUCT_ID: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    QA_DATABASE_URL: 'postgresql://roulette_local_admin:' + password + '@127.0.0.1:55437/roulette_qa' }
  const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.integration.config.ts', '--reporter=json', '--outputFile=test-results/local-postgres/integration-results.json'], { env, stdio: 'inherit' })
  if (run.status !== 0) throw new Error('Integration suite failed; see local integration-results.json')
  const tests = JSON.parse(fs.readFileSync('test-results/local-postgres/integration-results.json', 'utf8'))
  console.log('Integration: ' + tests.numPassedTests + '/' + tests.numTotalTests + ' passed')
  await db.query(artifact('qa-seven-outcomes.test.sql'))
  await db.query(artifact('04-restore-production-helpers.review.sql'))
  await db.query(artifact('qa-rng-distribution.test.sql'))
  const final = (await db.query("select version(),current_setting('TimeZone') as timezone,to_regclass('roulette_qa.control') as qa_controls,(select enabled from roulette_settings where singleton) as enabled")).rows[0]
  const files = ['01-roulette.review.sql', '02-reporting.review.sql', '03-qa-controls.review.sql', '04-restore-production-helpers.review.sql']
  const report = { status: 'passed', environment: 'isolated local PostgreSQL only', tests: { passed: tests.numPassedTests, total: tests.numTotalTests }, final, notices,
    sql: files.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(path.join(sqlDirectory, file))).digest('hex') })),
    limitations: ['PostgreSQL 18, not hosted PostgreSQL 17', 'No Supabase Auth/PostgREST or browser delivery acceptance', 'NULL source tested only with transactional local NOT NULL relaxation'] }
  fs.writeFileSync('src/docs-features/roulette/local-db-results.json', JSON.stringify(report, null, 2) + '\n')
  console.log('Local SQL/integration/RNG checks passed; QA controls removed. Production untouched.')
} finally { await db.end() }

