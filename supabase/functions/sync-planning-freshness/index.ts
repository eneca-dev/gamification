import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ENECAWORK_URL = Deno.env.get('ENECAWORK_SUPABASE_URL');
if (!ENECAWORK_URL) throw new Error('Missing env: ENECAWORK_SUPABASE_URL');

const ENECAWORK_KEY = Deno.env.get('ENECAWORK_SERVICE_ROLE_KEY');
if (!ENECAWORK_KEY) throw new Error('Missing env: ENECAWORK_SERVICE_ROLE_KEY');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
if (!SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL');

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

const SYNC_SECRET = Deno.env.get('SYNC_SECRET');

// ID подразделения "Производственные отделы" в eneca.work
const PRODUCTION_SUBDIVISION_ID = '2693c80e-869e-4e0c-8d2c-62b17e01166c';

// UTC+3 Минск
const MINSK_OFFSET_MS = 3 * 60 * 60 * 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const enecaHeaders = {
  'apikey': ENECAWORK_KEY,
  'Authorization': `Bearer ${ENECAWORK_KEY}`,
  'Content-Type': 'application/json',
};

interface FreshnessRow {
  team_id: string;
  team_name: string;
  department_id: string;
  department_name: string;
  last_confirmed_at: string | null;
  last_loading_update: string | null;
  active_loadings_count: number;
  last_update: string | null;
  days_since_update: number;
}

interface TeamRow {
  team_id: string;
  ws_team_id: number | null;
  team_lead_id: string | null;
  department_id: string;
}

interface DepartmentRow {
  department_id: string;
  department_head_id: string | null;
}

interface ProfileRow {
  user_id: string;
  email: string;
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const res = await fetch(`${ENECAWORK_URL}/rest/v1/${path}`, {
    headers: enecaHeaders,
  });
  if (!res.ok) {
    throw new Error(`eneca.work GET ${path} failed: HTTP ${res.status}`);
  }
  return res.json() as Promise<T[]>;
}

// Дата по минскому времени: YYYY-MM-DD
function getMinskyDateStr(): string {
  return new Date(Date.now() + MINSK_OFFSET_MS).toISOString().split('T')[0];
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
  const isSnapshot = url.searchParams.get('snapshot') === 'true';

  try {
    // 1. Только производственные отделы + вся view_planning_team_freshness параллельно
    const [productionDepts, allFreshnessRows, allTeams] = await Promise.all([
      fetchAll<DepartmentRow>(
        `departments?select=department_id,department_head_id&subdivision_id=eq.${PRODUCTION_SUBDIVISION_ID}`
      ),
      fetchAll<FreshnessRow>('view_planning_team_freshness?select=*'),
      fetchAll<TeamRow>('teams?select=team_id,ws_team_id,team_lead_id,department_id'),
    ]);

    // 2. Множество ID производственных отделов
    const productionDeptIds = new Set(productionDepts.map((d) => d.department_id));

    // 3. Фильтруем freshness — только производственные отделы
    const freshnessRows = allFreshnessRows.filter((f) =>
      productionDeptIds.has(f.department_id)
    );

    // 4. Собираем все уникальные user_id для минимального запроса профилей
    const deptMap = new Map(productionDepts.map((d) => [d.department_id, d]));
    const teamMap = new Map(allTeams.map((t) => [t.team_id, t]));

    const userIds = new Set<string>();
    for (const f of freshnessRows) {
      const dept = deptMap.get(f.department_id);
      if (dept?.department_head_id) userIds.add(dept.department_head_id);
      const team = teamMap.get(f.team_id);
      if (team?.team_lead_id) userIds.add(team.team_lead_id);
    }

    // 5. Загружаем только нужные профили
    let profileMap = new Map<string, string>();
    if (userIds.size > 0) {
      const ids = [...userIds].join(',');
      const profiles = await fetchAll<ProfileRow>(
        `profiles?select=user_id,email&user_id=in.(${ids})`
      );
      profileMap = new Map(profiles.map((p) => [p.user_id, p.email]));
    }

    const now = new Date().toISOString();

    // 6. Собираем итоговые строки
    const rows = freshnessRows.map((f) => {
      const team = teamMap.get(f.team_id);
      const dept = deptMap.get(f.department_id);

      return {
        team_id: f.team_id,
        ws_team_id: team?.ws_team_id ?? null,
        team_name: f.team_name,
        department_id: f.department_id,
        department_name: f.department_name,
        last_confirmed_at: f.last_confirmed_at,
        last_loading_update: f.last_loading_update,
        active_loadings_count: f.active_loadings_count,
        last_update: f.last_update,
        days_since_update: f.days_since_update,
        team_lead_email: team?.team_lead_id
          ? (profileMap.get(team.team_lead_id) ?? null)
          : null,
        department_head_email: dept?.department_head_id
          ? (profileMap.get(dept.department_head_id) ?? null)
          : null,
        synced_at: now,
      };
    });

    // 7. Upsert в planning_freshness
    const { error: upsertError } = await supabase
      .from('planning_freshness')
      .upsert(rows, { onConflict: 'team_id' });

    if (upsertError) throw new Error(`planning_freshness upsert: ${upsertError.message}`);

    // 8. Снапшот в planning_freshness_daily (если ?snapshot=true)
    let snapshotCount = 0;
    if (isSnapshot) {
      // Дата по минскому времени — снапшот всегда за текущий минский день
      const today = getMinskyDateStr();

      const dailyRows = rows.map((r) => ({
        snapshot_date: today,
        team_id: r.team_id,
        ws_team_id: r.ws_team_id,
        team_name: r.team_name,
        department_id: r.department_id,
        department_name: r.department_name,
        days_since_update: r.days_since_update,
        last_update: r.last_update,
        active_loadings_count: r.active_loadings_count,
        team_lead_email: r.team_lead_email,
        department_head_email: r.department_head_email,
      }));

      const { error: snapshotError } = await supabase
        .from('planning_freshness_daily')
        .upsert(dailyRows, { onConflict: 'team_id,snapshot_date' });

      if (snapshotError) throw new Error(`planning_freshness_daily upsert: ${snapshotError.message}`);
      snapshotCount = dailyRows.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        synced: rows.length,
        snapshot: isSnapshot ? snapshotCount : null,
        synced_at: now,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
