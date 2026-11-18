'use client'

import { useRouter } from 'next/navigation'
import { CoinStatic } from '@/components/CoinBalance'
import { createCacheMutation, createCacheQuery, queryKeys } from '@/modules/cache'
import { getRouletteSettingsAction, setRouletteEnabledAction } from '../actions'

const useSettings = createCacheQuery({
  queryKey: () => [...queryKeys.roulette.all, 'settings'],
  queryFn: getRouletteSettingsAction,
  staleTime: 0,
})
const useToggle = createCacheMutation({
  mutationFn: setRouletteEnabledAction,
  invalidateKeys: [queryKeys.roulette.all],
})
interface RouletteAdminProps {
  enabled: boolean | null
  stats: { spins: number; players: number; bets: number; balancesAfter: number; delta: number; zeroShare: number } | null
}
export function RouletteAdmin({ enabled, stats }: RouletteAdminProps) {
  const router = useRouter()
  const settings = useSettings(undefined, { initialData: enabled ?? undefined, refetchOnWindowFocus: true, refetchInterval: 15000 })
  const unavailable = settings.data === undefined || settings.isError || settings.isFetching
  const toggle = useToggle({ onSuccess: () => router.refresh() })
  return (
    <section className="mt-6 rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-5 text-[var(--apex-text)]" aria-labelledby="roulette-admin-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="roulette-admin-title" className="text-xl font-bold">Рулетка</h2>
        <button type="button" role="switch" aria-checked={settings.data ?? false} disabled={toggle.isPending || unavailable}
          className="rounded-xl border border-[var(--apex-border)] px-4 py-2 disabled:opacity-50"
          onClick={() => toggle.mutate({ enabled: !settings.data })}>
          {unavailable ? 'Проверяем выключатель…' : settings.data ? 'Выключить рулетку' : 'Включить рулетку'}
        </button>
      </div>
      <p className="mt-2 text-sm text-[var(--apex-text-secondary)]">Выключение запрещает новые ходы. Уже прошедший проверку ход завершится, сохранённые результаты останутся доступны.</p>
      {settings.isError && <p role="alert">Не удалось проверить положение выключателя. <button type="button" className="underline" onClick={() => void settings.refetch()}>Обновить</button></p>}
      {toggle.error && <p role="alert">{toggle.error.message}</p>}
      {!stats ? <p role="status" className="mt-4">Статистика недоступна. Обновите страницу, чтобы загрузить показатели.</p> : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div><dt>Сумма ставок</dt><dd><CoinStatic amount={stats.bets} /></dd></div>
          <div><dt>Сумма балансов после ходов</dt><dd><CoinStatic amount={stats.balancesAfter} /></dd></div>
          <div><dt>Изменение кристаллов</dt><dd><CoinStatic amount={stats.delta} /></dd></div>
          <div><dt>Уникальные игроки</dt><dd>{stats.players} ({stats.spins} ходов)</dd></div>
          <div><dt>Доля обнулений</dt><dd>{(stats.zeroShare * 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%</dd></div>
        </dl>
      )}
    </section>
  )
}
