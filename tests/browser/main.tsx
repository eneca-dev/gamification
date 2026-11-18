import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CoinBalanceLive } from '@/components/CoinBalance'
import { RoulettePanel } from '@/modules/roulette/components/RoulettePanel'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import { fixture, fixtureUser, scenario } from './fixture-actions'
import '@/app/globals.css'

const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
const qa = { fixture, refetchBalance: () => client.refetchQueries({ queryKey: queryKeys.balance.current(fixtureUser) }) }
declare global { interface Window { rouletteQa: typeof qa } }
window.rouletteQa = qa

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <main className="mx-auto max-w-6xl p-4">
        <h1 className="mb-4 text-xl font-bold">Локальный QA — только синтетические данные</h1>
        <p className="mb-4">Сценарий: {scenario}. Рабочая БД и интеграции не подключены.</p>
        <aside aria-label="Баланс в боковом меню"><CoinBalanceLive initialAmount={1000} userId={fixtureUser} /></aside>
        <RoulettePanel userId={fixtureUser} isImpersonating={scenario === 'impersonating'} />
      </main>
    </QueryClientProvider>
  </StrictMode>,
)
