import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import pg from 'pg'
const directory = path.resolve('test-results/local-postgres')
const database = process.env.QA_LOCAL_DATABASE ?? 'roulette_qa_exact'
if (!['roulette_qa', 'roulette_qa_exact'].includes(database)) throw new Error('Unapproved local database name')
const password = fs.readFileSync(path.join(directory, 'password.txt'), 'utf8').trim()
const project = 'localroulettefixture'
const db = new pg.Client({ host: '127.0.0.1', port: 55437, user: 'roulette_local_admin', password, database, connectionTimeoutMillis: 3000 })
const sqlDirectory = 'src/docs-features/roulette/sql'
const artifact = file => fs.readFileSync(path.join(sqlDirectory, file), 'utf8').replace(/^\uFEFF/, '').replaceAll('REPLACE_WITH_APPROVED_QA_PROJECT_REF', project)
const notices = []
const resultPath = 'src/docs-features/roulette/local-db-results.json'
const reportNames = ['get_adoption_monthly_summary_v3', 'get_adoption_period_core_v2', 'get_economy_overview', 'get_economy_top']
const definitions = async names => (await db.query("select p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as definition, md5(pg_get_functiondef(p.oid)) as md5, p.proowner::regrole::text as owner, p.proacl::text as acl, p.proconfig, p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','roulette_private') and p.proname=any($1::text[]) order by 1", [names])).rows
let mutationsStarted = false
let helperDefinitions = []
let reportsBefore = []
let reportsAfter = []
let recoveryVerified = false
let passed = false
fs.writeFileSync(resultPath, JSON.stringify({ status: 'running', database, startedAt: new Date().toISOString() }, null, 2) + '\n')
db.on('notice', notice => { notices.push(notice.message); console.log(notice.message) })
try {
  await db.connect()
  const identity = (await db.query("select current_setting('data_directory') as directory,inet_server_port() as port,current_user as username")).rows[0]
  if (identity.directory.replaceAll('\\', '/') !== path.join(directory, 'data').replaceAll('\\', '/') || identity.port !== 55437 || identity.username !== 'roulette_local_admin') throw new Error('Refusing a different PostgreSQL cluster')
  if (!(await db.query('select exists(select 1 from qa_guard.environment where project_ref=$1 and outbound_reviewed and overrides_approved) as safe', [project])).rows[0].safe) throw new Error('Local fixture marker missing')
  const extensions = (await db.query('select extname from pg_extension')).rows.map(row => row.extname)
  if (extensions.some(name => !['plpgsql', 'pgcrypto'].includes(name))) throw new Error('Unexpected extensions; review before testing')
  helperDefinitions = await definitions(['roulette_now', 'roulette_sector'])
  reportsBefore = await definitions(reportNames)
  const installed = await definitions(['roulette_now', 'roulette_sector', 'spin_roulette', 'get_roulette_result', 'get_roulette_state', 'get_roulette_stats'])
  const provenancePath = path.join(directory, database + '-installation.json')
  if (!fs.existsSync(provenancePath)) throw new Error('Fresh literal SQL01 installation evidence required')
  const installation = JSON.parse(fs.readFileSync(provenancePath, 'utf8'))
  const sql01Hash = createHash('sha256').update(fs.readFileSync(path.join(sqlDirectory, '01-roulette.review.sql'))).digest('hex')
  if (installation.database !== database || installation.sql01 !== sql01Hash || JSON.stringify(installation.functions) !== JSON.stringify(installed.map(({ signature, md5 }) => ({ signature, md5 })))) throw new Error('Installed SQL01 differs from recorded exact package')
  if ((await db.query("select to_regclass('roulette_qa.control') as present")).rows[0].present) throw new Error('Previous QA controls require explicit recovery before a new suite')
  mutationsStarted = true
  if (!(await db.query("select to_regclass('roulette_qa.control') as present")).rows[0].present) await db.query(artifact('03-qa-controls.review.sql'))
  const env = { ...process.env, QA_LOCAL_POSTGRES: 'true', QA_PROJECT_REF: project, QA_ALLOW_DB_MUTATIONS: 'approved', QA_ENVIRONMENT_REVIEWED: 'true',
    QA_PRODUCT_ID: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    QA_DATABASE_URL: 'postgresql://roulette_local_admin:' + password + '@127.0.0.1:55437/' + database }
  const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.integration.config.ts', '--reporter=json', '--outputFile=test-results/local-postgres/integration-results.json'], { env, stdio: 'inherit' })
  if (run.status !== 0) throw new Error('Integration suite failed; see local integration-results.json')
  const tests = JSON.parse(fs.readFileSync('test-results/local-postgres/integration-results.json', 'utf8'))
  console.log('Integration: ' + tests.numPassedTests + '/' + tests.numTotalTests + ' passed')
  await db.query(artifact('qa-seven-outcomes.test.sql'))
  await db.query(artifact('04-restore-production-helpers.review.sql'))
  for (const row of helperDefinitions) await db.query(row.definition)
  await db.query(artifact('qa-rng-distribution.test.sql'))
  // Prepare recovery before any committed reporting change, including a lost COMMIT response.
  await db.query('begin')
  await db.query(artifact('02-reporting.review.sql').replace(/^begin;\r?$/im, '').replace(/^commit;\r?$/im, ''))
  reportsAfter = await definitions(reportNames)
  await db.query('rollback')
  const checks = reportsBefore.map((row, i) => `if md5(pg_get_functiondef('${row.signature}'::regprocedure)) not in ('${row.md5}','${reportsAfter[i].md5}') then raise exception 'Unexpected report definition: ${row.signature}'; end if;`).join('\n')
  const restoredChecks = reportsBefore.map(row => `if md5(pg_get_functiondef('${row.signature}'::regprocedure)) <> '${row.md5}' then raise exception 'Report restore failed: ${row.signature}'; end if;`).join('\n')
  const recovery = '-- REVIEW ONLY: restores the approved original four report definitions. No balance/history changes.\nbegin;\nset local lock_timeout=\'5s\';\nset local statement_timeout=\'60s\';\ndo $guard$ begin\n' + checks + '\nend $guard$;\n' + reportsBefore.map(row => row.definition + ';').join('\n') + '\ndo $verify$ begin\n' + restoredChecks + '\nend $verify$;\ncommit;\n'
  fs.writeFileSync(path.join(sqlDirectory, '05-restore-reporting.review.sql'), recovery)
  // Separately test the literal transaction-wrapped package.
  await db.query(artifact('02-reporting.review.sql'))
  if (process.env.QA_TEST_FAILURE_AFTER_SQL02_COMMIT === 'true') throw new Error('Injected local failure after SQL02 COMMIT')
  if (JSON.stringify(await definitions(reportNames)) !== JSON.stringify(reportsAfter)) throw new Error('Committed SQL02 differs from the recovery snapshot')
  await db.query(recovery)
  if (JSON.stringify(await definitions(reportNames)) !== JSON.stringify(reportsBefore)) throw new Error('Reports metadata or definitions not restored exactly')
  if (JSON.stringify(await definitions(['roulette_now', 'roulette_sector'])) !== JSON.stringify(helperDefinitions)) throw new Error('Helpers not restored exactly')
  recoveryVerified = true
  const final = (await db.query("select version(),current_setting('TimeZone') as timezone,to_regclass('roulette_qa.control') as qa_controls,(select enabled from roulette_settings where singleton) as enabled")).rows[0]
  const files = ['01-roulette.review.sql', '02-reporting.review.sql', '03-qa-controls.review.sql', '04-restore-production-helpers.review.sql']
  const report = { status: 'passed', verifiedAt: new Date().toISOString(), database, installation, environment: 'isolated local PostgreSQL only', tests: { passed: tests.numPassedTests, total: tests.numTotalTests }, final, notices,
    literalSql02Applied: true, recoveryVerified, reports: reportsBefore.map((row, i) => ({ signature: row.signature, beforeMd5: row.md5, afterMd5: reportsAfter[i].md5, restoredMd5: row.md5, metadataPreserved: true })),
    sql: files.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(path.join(sqlDirectory, file))).digest('hex') })),
    limitations: ['PostgreSQL 18, not hosted PostgreSQL 17', 'No Supabase Auth/PostgREST or browser delivery acceptance', 'NULL source tested only with transactional local NOT NULL relaxation'] }
  fs.writeFileSync(resultPath, JSON.stringify(report, null, 2) + '\n')
  passed = true
  console.log('Local SQL/integration/RNG checks passed; QA controls removed. Production untouched.')
} catch (error) {
  fs.writeFileSync(resultPath, JSON.stringify({ status: 'failed', database, error: error.message, recoveryVerified }, null, 2) + '\n')
  throw error
} finally {
  try {
    if (mutationsStarted && !passed) {
      await db.query('rollback')
      if ((await db.query("select to_regclass('roulette_qa.control') as present")).rows[0].present) await db.query(artifact('04-restore-production-helpers.review.sql'))
      for (const row of helperDefinitions) await db.query(row.definition)
      if (reportsAfter.length) {
        const current = await definitions(reportNames)
        if (current.some((row, i) => ![reportsBefore[i].md5, reportsAfter[i].md5].includes(row.md5))) throw new Error('Unknown report definition during cleanup')
        await db.query('begin')
        for (const row of reportsBefore) await db.query(row.definition)
        await db.query('commit')
      }
      await db.query('update public.roulette_settings set enabled=false where singleton')
      if (reportsBefore.length && JSON.stringify(await definitions(reportNames)) !== JSON.stringify(reportsBefore)) throw new Error('Cleanup did not restore reporting metadata')
      const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
      fs.writeFileSync(resultPath, JSON.stringify({ ...result, cleanupVerified: true }, null, 2) + '\n')
    }
  } catch (cleanupError) {
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
    fs.writeFileSync(resultPath, JSON.stringify({ ...result, cleanupError: cleanupError.message }, null, 2) + '\n')
    throw cleanupError
  } finally { await db.end() }
}

