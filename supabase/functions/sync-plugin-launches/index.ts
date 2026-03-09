import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Env vars с явной проверкой при запуске
const KIBANA_URL = Deno.env.get('KIBANA_URL');
if (!KIBANA_URL) throw new Error('Missing env: KIBANA_URL');

const KIBANA_API_KEY = Deno.env.get('KIBANA_API_KEY');
if (!KIBANA_API_KEY) throw new Error('Missing env: KIBANA_API_KEY');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
if (!SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL');

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

const SYNC_SECRET = Deno.env.get('SYNC_SECRET');

const KIBANA_SEARCH_URL = `${KIBANA_URL}/kibana/internal/search/es`;

// Только плагины из утверждённого списка геймификации (без InstallationManager)
const PLUGIN_INDICES = [
  'auditor-*', 'clashesmanager-*', 'linksmanager-*', 'sharemodel-*',
  'sdt-*', 'paramoperator-*', 'apartmentlayouts-*',
  'fasciacappings-*', 'spacesmanager-*', 'resavemodels-*', 'autoopenings-*',
  'finishing-*', 'sharedcoordinates-*', 'eneca.sharedcoordinates-*',
  'profilay-*', 'lookuptables-*', 'viewcloner-*', 'lintelstransfer-*',
  'surfacegen-*', 'quickmount-*', 'schedulestable-*',
].join(',');

// Сотрудники работают в UTC+3 (Минск)
const MINSK_OFFSET_MS = 3 * 60 * 60 * 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Возвращает дату в формате YYYY-MM-DD по минскому времени
function toMinskyDateStr(utcDate: Date): string {
  return new Date(utcDate.getTime() + MINSK_OFFSET_MS).toISOString().split('T')[0];
}

interface PluginLaunchRow {
  user_email: string;
  plugin_name: string;
  work_date: string;
  launch_count: number;
  synced_at: string;
}

interface SyncDayResult {
  date: string;
  synced: number;
  error?: string;
}

async function fetchLaunchesForDay(minskyDateStr: string): Promise<PluginLaunchRow[]> {
  // Следующий день в Минске — строковая арифметика через Date.UTC,
  // чтобы не получить тот же день из-за UTC-конверсии toISOString()
  const [y, m, d] = minskyDateStr.split('-').map(Number);
  const minskyNextDateStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().split('T')[0];

  const res = await fetch(KIBANA_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'kbn-xsrf': 'true',
      'Authorization': `ApiKey ${KIBANA_API_KEY}`,
    },
    body: JSON.stringify({
      params: {
        index: PLUGIN_INDICES,
        body: {
          size: 0,
          query: {
            bool: {
              filter: [
                { term: { 'Properties.IsEnecaUser': true } },
                { term: { 'MessageTemplate.keyword': 'App successfully started' } },
                {
                  range: {
                    '@timestamp': {
                      gte: `${minskyDateStr}T00:00:00+03:00`,
                      lt: `${minskyNextDateStr}T00:00:00+03:00`,
                    },
                  },
                },
              ],
            },
          },
          // composite aggregation — плоский список (email + plugin) без вложенности
          aggs: {
            by_user_plugin: {
              composite: {
                size: 10000,
                sources: [
                  { email: { terms: { field: 'Properties.Email.keyword' } } },
                  { plugin: { terms: { field: 'Properties.AppName.keyword' } } },
                ],
              },
            },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Kibana HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();

  interface CompositeBucket {
    key: { email: string; plugin: string };
    doc_count: number;
  }

  const buckets: CompositeBucket[] =
    data.rawResponse?.aggregations?.by_user_plugin?.buckets ?? [];

  const now = new Date().toISOString();

  return buckets
    .filter((b) => b.doc_count > 0)
    .map((b) => ({
      user_email: b.key.email.toLowerCase(),
      plugin_name: b.key.plugin,
      work_date: minskyDateStr,
      launch_count: b.doc_count,
      synced_at: now,
    }));
}

async function syncDay(minskyDateStr: string): Promise<number> {
  const rows = await fetchLaunchesForDay(minskyDateStr);
  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from('plugin_launches')
    .upsert(rows, { onConflict: 'user_email,work_date,plugin_name' });

  if (error) throw new Error(`Supabase upsert: ${error.message}`);
  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (SYNC_SECRET) {
    const auth = req.headers.get('Authorization');
    if (auth !== `Bearer ${SYNC_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const url = new URL(req.url);
  // ?days=1 — вчера по минскому времени (default, для ежедневного cron)
  // ?days=100 — бэкфилл за 100 дней
  const daysParam = parseInt(url.searchParams.get('days') ?? '1', 10);
  const days = Math.max(1, Math.min(Number.isNaN(daysParam) ? 1 : daysParam, 100));

  const results: SyncDayResult[] = [];

  for (let i = days; i >= 1; i--) {
    const utcDate = new Date();
    utcDate.setDate(utcDate.getDate() - i);
    const minskyDateStr = toMinskyDateStr(utcDate);

    try {
      const synced = await syncDay(minskyDateStr);
      results.push({ date: minskyDateStr, synced });
    } catch (e) {
      results.push({ date: minskyDateStr, synced: 0, error: String(e) });
    }
  }

  const totalSynced = results.reduce((acc, r) => acc + r.synced, 0);

  return new Response(
    JSON.stringify({ ok: true, days, totalSynced, results }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
