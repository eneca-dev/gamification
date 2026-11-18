import { canUseRoulettePilot } from '@/config/roulette'
import { redirect } from 'next/navigation'
import { bimoEnabled, getBimoState } from '@/modules/profile-appearance/queries'
import { BimoShop } from '@/modules/profile-appearance/components/BimoShop'
import { getCurrentUser } from '@/modules/auth'
import { getProducts, getCategories, getUserBalance } from '@/modules/shop'
import { getShieldQuota, getShieldCredits } from '@/modules/streak-shield'
import { getRouletteEnabled } from '@/modules/roulette'
import { RoulettePanel } from '@/modules/roulette/components/RoulettePanel'
import { StoreClient } from '@/modules/shop/components/StoreClient'
import { resolveStoreTab } from '@/modules/shop/navigation'

export default async function StorePage({ searchParams }: { searchParams: Promise<{ tab?: string; category?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const showBimo = bimoEnabled() && Boolean(user.wsUserId)
  const params = await searchParams
  const tab = resolveStoreTab(params.tab, showBimo, Boolean(user.wsUserId))
  const catalog = tab === 'catalog'
  const [categories, showRoulette, products, balance, shieldQuota, shieldCredits, bimoState] = await Promise.all([
    getCategories(),
    user.wsUserId && canUseRoulettePilot(user) ? getRouletteEnabled() : false,
    catalog ? getProducts() : [],
    tab !== 'roulette' && user.wsUserId ? getUserBalance(user.wsUserId) : 0,
    catalog && user.wsUserId ? getShieldQuota(user.wsUserId) : null,
    catalog && user.wsUserId ? getShieldCredits(user.wsUserId) : { ws: 0, revit: 0 },
    tab === 'bimo' && user.wsUserId ? getBimoState(user.wsUserId) : null,
  ])
  const selectedCategory = categories.some(category => category.slug === params.category) ? params.category : undefined
  return (
    <div className="space-y-6">
      <StoreClient
        key={tab + ':' + (selectedCategory ?? 'all')}
        activeTab={tab}
        userId={user.wsUserId}
        showBimo={showBimo}
        showRoulette={showRoulette === true}
        initialCategory={selectedCategory}
        bimoContent={bimoState && user.wsUserId ? <BimoShop userId={user.wsUserId} initialState={bimoState} balance={balance} /> : null}
        rouletteContent={tab === 'roulette' && user.wsUserId ? <RoulettePanel userId={user.wsUserId} isImpersonating={Boolean(user.isImpersonating)} /> : null}
        products={products}
        categories={categories}
        balance={balance}
        shieldQuota={shieldQuota}
        shieldCredits={shieldCredits}
      />
    </div>
  )
}
