import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Env vars: автоматически доступны в Edge Functions
const KIBANA_URL = Deno.env.get('KIBANA_URL')!;
const KIBANA_API_KEY = Deno.env.get('KIBANA_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYNC_SECRET = Deno.env.get('SYNC_SECRET');

const KIBANA_SEARCH_URL = `${KIBANA_URL}/kibana/internal/search/es`;
const PLUGIN_INDICES = [
  'auditor-*', 'clashesmanager-*', 'enecafamilies-*', 'linksmanager-*',
  'sharemodel-*', 'installationmanager-*', 'sdt-*', 'hvacautotag-*',
  'paramoperator-*', 'apartmentlayouts-*', 'groundanalyzer-*', 'settorevit-*',
].join(',');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface PluginLaunchRow {
  user_email: string;
  work_date: string;
  launch_count: number;
  synced_at: string;
}

interface SyncDayResult {
  date: string;
  synced: number;
  error?: string;
}

async function fetchLaunchesForDay(date: Date): Promise<PluginLaunchRow[]> {
  const dateStr = toDateStr(date);
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = toDateStr(nextDate);

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
                    '@timestamp': { gte: dateStr, lt: nextDateStr, format: 'yyyy-MM-dd' },
                  },
                },
              ],
            },
          },
          aggs: {
            by_user: {
              terms: { field: 'Properties.Email.keyword', size: 10000 },
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
  const buckets: Array<{ key: string; doc_count: number }> =
    data.rawResponse?.aggregations?.by_user?.buckets ?? [];

  const now = new Date().toISOString();
  return buckets
    .filter((b) => b.doc_count > 0)
    .map((b) => ({
      user_email: b.key.toLowerCase(),
      work_date: dateStr,
      launch_count: b.doc_count,
      synced_at: now,
    }));
}

async function syncDay(date: Date): Promise<number> {
  const rows = await fetchLaunchesForDay(date);
  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from('plugin_launches')
    .upsert(rows, { onConflict: 'user_email,work_date' });

  if (error) throw new Error(`Supabase upsert: ${error.message}`);
  return rows.length;
}

Deno.serve(async (req) => {
  // Защита: если задан SYNC_SECRET — требуем его в заголовке
  if (SYNC_SECRET) {
    const auth = req.headers.get('Authorization');
    if (auth !== `Bearer ${SYNC_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const url = new URL(req.url);
  // ?days=1 — вчера (default, для ежедневного cron)
  // ?days=30 — бэкфилл за 30 дней
  const daysParam = parseInt(url.searchParams.get('days') ?? '1', 10);
  const days = Math.max(1, Math.min(Number.isNaN(daysParam) ? 1 : daysParam, 30));

  const results: SyncDayResult[] = [];

  for (let i = days; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    try {
      const synced = await syncDay(date);
      results.push({ date: toDateStr(date), synced });
    } catch (e) {
      results.push({ date: toDateStr(date), synced: 0, error: String(e) });
    }
  }

  const totalSynced = results.reduce((acc, r) => acc + r.synced, 0);

  return new Response(
    JSON.stringify({ ok: true, days, totalSynced, results }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
