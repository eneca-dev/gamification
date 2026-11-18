import { Client } from 'pg'
import { resolve } from 'node:path'

export async function connectQa() {
  const connectionString = process.env.QA_DATABASE_URL
  const project = process.env.QA_PROJECT_REF
  if (!connectionString || !project || process.env.QA_ALLOW_DB_MUTATIONS !== 'approved'
    || process.env.QA_ENVIRONMENT_REVIEWED !== 'true' || project === 'yqezhfughtublpaitmij') {
    throw new Error('Explicitly approved isolated QA connection and fixture mutations required')
  }
  const url = new URL(connectionString)
  const local = process.env.QA_LOCAL_POSTGRES === 'true'
  if (local) {
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '55437'
      || !['/roulette_qa', '/roulette_qa_exact'].includes(url.pathname) || url.username !== 'roulette_local_admin' || url.search || url.hash
      || project !== 'localroulettefixture') throw new Error('Exact isolated local PostgreSQL identity required')
  } else if (url.hostname !== 'db.' + project + '.supabase.co') {
    throw new Error('QA database host does not match approved project')
  }
  const connection = local ? { host: '127.0.0.1', port: 55437, database: url.pathname.slice(1), user: 'roulette_local_admin', password: decodeURIComponent(url.password) } : { connectionString }
  const client = new Client({ ...connection, application_name: 'roulette-qa-tests', connectionTimeoutMillis: 10000, statement_timeout: 25000, lock_timeout: 15000, ssl: local ? false : { rejectUnauthorized: true } })
  await client.connect()
  if (local) {
    const identity = await client.query<{ directory: string }>("select current_setting('data_directory') as directory")
    if (identity.rows[0].directory.replaceAll('\\', '/') !== resolve('test-results/local-postgres/data').replaceAll('\\', '/')) {
      await client.end()
      throw new Error('Refusing an existing unrelated PostgreSQL cluster')
    }
  }
  return client
}
