import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
if (!AIRTABLE_PAT) throw new Error('Missing env: AIRTABLE_PAT');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
if (!SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL');

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

const SYNC_SECRET = Deno.env.get('SYNC_SECRET');

const AIRTABLE_BASE_ID = 'appiZJLCtufkX2PME';
const AIRTABLE_TABLE_ID = 'tblxA2ogpIzSCI2gp';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: {
    Name?: string;
    'Спасибо за'?: string;
    'Status'?: string;
    'Время создания'?: string;
    'Почта От кого'?: string[];
    'Почта Кому'?: string[];
  };
}

interface GratitudeRow {
  id: string;
  sender_email: string | null;
  recipient_email: string | null;
  recipient_name: string;
  message: string;
  airtable_created_at: string;
  week_start: string;
  airtable_status: string | null;
  deleted_in_airtable: boolean;
  synced_at: string;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

// Загружаем записи за указанные месяцы (массив номеров 1-12)
// Фильтр: OR({Месяц}=11,{Месяц}=12,{Месяц}=1,...) AND IS_AFTER(дата, начало_периода)
function buildMultiMonthFilter(months: number[], sinceDate: string): string {
  const monthConditions = months.map((m) => `{Месяц}=${m}`).join(',');
  return `AND(OR(${monthConditions}),IS_AFTER({Время создания},'${sinceDate}'))`;
}

async function fetchRecords(filter: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: '100',
      filterByFormula: filter,
    });
    if (offset) params.set('offset', offset);

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?${params}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } },
    );

    if (!res.ok) {
      throw new Error(`Airtable API ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
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

  // Параметры: сколько месяцев назад загружать (по умолчанию 5)
  let monthsBack = 5;
  try {
    const body = await req.json();
    if (body.months_back) monthsBack = Number(body.months_back);
  } catch {
    // нет body — используем дефолт
  }

  const now = new Date();
  const nowStr = now.toISOString();

  // Вычисляем список месяцев и дату начала
  const months: number[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getMonth() + 1); // 1-12
  }
  // Уникальные номера месяцев
  const uniqueMonths = [...new Set(months)];

  // Дата начала периода — первый день самого раннего месяца минус 1 день (для IS_AFTER)
  const earliest = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0);
  const sinceDate = earliest.toISOString().split('T')[0];

  const filter = buildMultiMonthFilter(uniqueMonths, sinceDate);

  // Загружаем из Airtable
  const airtableRecords = await fetchRecords(filter);

  // Маппинг
  const rows: GratitudeRow[] = airtableRecords.map((r) => {
    const createdAt = r.fields['Время создания'] ?? r.createdTime;
    const senderEmail = r.fields['Почта От кого']?.[0]?.toLowerCase() ?? null;
    const recipientEmail = r.fields['Почта Кому']?.[0]?.toLowerCase() ?? null;

    return {
      id: r.id,
      sender_email: senderEmail,
      recipient_email: recipientEmail,
      recipient_name: r.fields['Name'] ?? '',
      message: r.fields['Спасибо за'] ?? '',
      airtable_created_at: createdAt,
      week_start: getWeekStart(createdAt),
      airtable_status: r.fields['Status'] ?? null,
      deleted_in_airtable: false,
      synced_at: nowStr,
    };
  });

  // Upsert батчами
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from('at_gratitudes')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'id' });
    if (error) throw new Error(`Gratitudes upsert: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      filter,
      months_back: monthsBack,
      unique_months: uniqueMonths,
      since_date: sinceDate,
      fetched: airtableRecords.length,
      upserted: rows.length,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
