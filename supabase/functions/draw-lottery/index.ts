// Крон: 1-е число каждого месяца в 09:00 UTC (12:00 Минск)
// Supabase Dashboard → Database → Extensions → pg_cron
// SELECT cron.schedule('draw-lottery', '0 9 1 * *', $$SELECT ... $$);
// Или через Supabase Functions Schedule в Dashboard

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
if (!SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL');

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

const SYNC_SECRET = Deno.env.get('SYNC_SECRET');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  // Авторизация (аналог других edge functions)
  if (SYNC_SECRET) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${SYNC_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    // Находим активную лотерею
    const { data: lottery, error: fetchError } = await supabase
      .from('lottery_draws')
      .select('id, name, month, product_id')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (fetchError || !lottery) {
      return new Response(
        JSON.stringify({ message: 'Нет активной лотереи для розыгрыша' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Проверяем что месяц лотереи прошёл (розыгрыш 1-го числа следующего месяца)
    const lotteryMonth = new Date(lottery.month);
    const now = new Date();
    const currentMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

    if (currentMonth <= lotteryMonth) {
      return new Response(
        JSON.stringify({ message: 'Месяц лотереи ещё не завершён', lottery_month: lottery.month }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Вызываем RPC розыгрыша
    const { data: result, error: drawError } = await supabase.rpc('draw_lottery_winner', {
      p_lottery_id: lottery.id,
    });

    if (drawError) {
      console.error('draw_lottery_winner error:', drawError.message);
      return new Response(
        JSON.stringify({ error: drawError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Лотерея "${lottery.name}" завершена. Победитель: ${result.winner_name} (${result.winner_email}). Билетов: ${result.total_tickets}`);

    return new Response(
      JSON.stringify({
        success: true,
        lottery: lottery.name,
        winner: result.winner_name,
        winner_email: result.winner_email,
        total_tickets: result.total_tickets,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('draw-lottery error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
