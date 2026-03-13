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

// ISO-неделя начинается в понедельник
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=Вс, 1=Пн, ..., 6=Сб
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

// Фильтруем только текущий месяц текущего года
// {Месяц} — формульное поле Airtable, учитывает Дата ручная
// IS_AFTER исключает записи прошлых лет с тем же номером месяца
function buildMonthFilter(): string {
  const now = new Date();
  const month = now.getUTCMonth() + 1; // 1-12
  const prevYearEnd = `${now.getUTCFullYear() - 1}-12-31`;
  return `AND({Месяц}=${month},IS_AFTER({Время создания},'${prevYearEnd}'))`;
}

async function fetchCurrentMonthRecords(): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  const filter = buildMonthFilter();

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

  const now = new Date().toISOString();

  // 1. Получаем записи только за текущий месяц
  const airtableRecords = await fetchCurrentMonthRecords();
  const airtableIds = new Set(airtableRecords.map((r) => r.id));

  // 2. Маппинг в строки Supabase
  const rows: GratitudeRow[] = airtableRecords.map((r) => {
    const createdAt = r.fields['Время создания'] ?? r.createdTime;
    // email-поля — lookup-массивы, берём первый элемент и приводим к нижнему регистру
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
      synced_at: now,
    };
  });

  // 3. Upsert в at_gratitudes батчами по 500
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from('at_gratitudes')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'id' });
    if (error) throw new Error(`Gratitudes upsert: ${error.message}`);
  }

  // 4. Soft-delete: записи исчезли из Airtable в этом месяце
  const { data: existing, error: existingErr } = await supabase
    .from('at_gratitudes')
    .select('id')
    .eq('deleted_in_airtable', false);

  if (existingErr) throw new Error(`Fetch existing: ${existingErr.message}`);

  const deletedIds = (existing ?? [])
    .map((r: { id: string }) => r.id)
    .filter((id) => !airtableIds.has(id));

  let markedDeleted = 0;
  if (deletedIds.length > 0) {
    const { error } = await supabase
      .from('at_gratitudes')
      .update({ deleted_in_airtable: true, synced_at: now })
      .in('id', deletedIds);
    if (error) throw new Error(`Soft delete: ${error.message}`);
    markedDeleted = deletedIds.length;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      month: new Date().toISOString().slice(0, 7),
      fetched: airtableRecords.length,
      upserted: rows.length,
      markedDeleted,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
