import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const directory = path.resolve('test-results/local-postgres')
const options = { host: '127.0.0.1', port: 55437, user: 'roulette_local_admin', password: fs.readFileSync(path.join(directory, 'password.txt'), 'utf8').trim(), connectionTimeoutMillis: 3000 }
const read = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
const artifact = file => read('src/docs-features/roulette/sql/' + file).replaceAll('REPLACE_WITH_APPROVED_QA_PROJECT_REF', 'localroulettefixture')
const admin = new pg.Client({ ...options, database: 'postgres' })
await admin.connect()
try {
  const identity = (await admin.query("select current_setting('data_directory') as directory,inet_server_port() as port")).rows[0]
  if (identity.directory.replaceAll('\\', '/') !== path.join(directory, 'data').replaceAll('\\', '/') || identity.port !== 55437) throw new Error('Wrong local cluster')
  // Never drop/reset an existing database; a name conflict must be reviewed.
  await admin.query('create database roulette_qa')
} finally { await admin.end() }
const db = new pg.Client({ ...options, database: 'roulette_qa' })
await db.connect()
try {
  await db.query('begin')
  await db.query(read('tests/integration/fixtures/local-baseline.sql'))
  await db.query('commit')
  await db.query(artifact('00-qa-marker.review.sql'))
  await db.query("update qa_guard.environment set outbound_reviewed=true,overrides_approved=true where project_ref='localroulettefixture'")
  await db.query(artifact('01-roulette.review.sql'))
  await db.query("insert into crystal_rates(rate) values(80)")
  await db.query("insert into gamification_event_types(key,coins,name,is_active,is_dynamic_coins,create_transaction) values('shop_purchase',0,'QA shop',true,true,true)")
  await db.query("insert into shop_categories(id,name,slug,is_physical,is_countable,is_active) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Local QA','local-qa',false,false,true)")
  await db.query("insert into shop_products(id,name,category_id,cost_byn,coefficient,is_active) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Local QA','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1.25,1,true)")
  console.log('Local schema and synthetic fixtures prepared. Roulette remains disabled.')
} finally { await db.end() }

