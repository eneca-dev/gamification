import { redirect } from 'next/navigation'
import { bimoEnabled, getBimoState } from '@/modules/profile-appearance/queries'
import { BimoShop } from '@/modules/profile-appearance/components/BimoShop'
import { BimoStill, bimoLook } from '@/modules/bimo-rig'

import { getCurrentUser } from '@/modules/auth'
import { getProducts, getCategories, getUserBalance } from '@/modules/shop'
import { getShieldQuota, getShieldCredits } from '@/modules/streak-shield'
// [LOTTERY HIDDEN] import { getActiveLottery, getLotteryHistory, getUserTicketInfo } from '@/modules/lottery'
import { StoreClient } from '@/modules/shop/components/StoreClient'
// [LOTTERY HIDDEN] import { LotteryReveal } from '@/modules/lottery/components/LotteryReveal'

export default async function StorePage({ searchParams }: { searchParams: Promise<{ tab?: string; category?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const showBimo = bimoEnabled() && Boolean(user.wsUserId)
  const params = await searchParams
  const bimoTab = showBimo && params.tab === 'bimo'

  // Гардероб нужен и для вкладки, и для плашки категории: на ней стоит мини-Бимо
  // в текущем образе, а тон плашки берётся из надетого фона.
  const [products, categories, balance, shieldQuota, shieldCredits, bimoState] = await Promise.all([
    getProducts(),
    getCategories(),
    user.wsUserId ? getUserBalance(user.wsUserId) : Promise.resolve(0),
    user.wsUserId ? getShieldQuota(user.wsUserId) : Promise.resolve(null),
    user.wsUserId ? getShieldCredits(user.wsUserId) : Promise.resolve({ ws: 0, revit: 0 }),
    showBimo && user.wsUserId ? getBimoState(user.wsUserId) : Promise.resolve(null),
    // [LOTTERY HIDDEN] getActiveLottery(),
    // [LOTTERY HIDDEN] getLotteryHistory(),
  ])
  const bimoTabLook = bimoState ? bimoLook(bimoState.equipment, bimoState.catalogArt) : null
  const selectedCategory = categories.some(category => category.slug === params.category) ? params.category : undefined

  // [LOTTERY HIDDEN] const ticketInfo = activeLottery && user.wsUserId
  //   ? await getUserTicketInfo(user.wsUserId, activeLottery.product_id)
  //   : null
  // [LOTTERY HIDDEN] const lastCompleted = lotteryHistory[0] ?? null
  // [LOTTERY HIDDEN] const wasParticipant = lastCompleted && user.wsUserId
  //   ? (await getUserTicketInfo(user.wsUserId, lastCompleted.product_id)).ticket_count > 0
  //   : false
  // [LOTTERY HIDDEN] const filteredProducts = activeLottery
  //   ? products.filter((p) => p.id !== activeLottery.product_id)
  //   : products

  return (
    <div className="space-y-6">
      {/* [LOTTERY HIDDEN] <LotteryReveal lottery={lastCompleted} wasParticipant={wasParticipant} /> */}

      <StoreClient
        key={bimoTab ? 'bimo' : selectedCategory ?? 'all'}
        showBimo={showBimo}
        bimoActive={bimoTab}
        initialCategory={selectedCategory}
        bimoContent={bimoTab && bimoState && user.wsUserId ? <BimoShop userId={user.wsUserId} initialState={bimoState} balance={balance} /> : null}
        bimoTabIcon={bimoTabLook ? <BimoStill {...bimoTabLook} compact alt="" /> : null}
        bimoTabTint={bimoTabLook?.backgroundSrc ?? null}
        products={products}
        categories={categories}
        balance={balance}
        shieldQuota={shieldQuota}
        shieldCredits={shieldCredits}
        // [LOTTERY HIDDEN] activeLottery={activeLottery}
        // [LOTTERY HIDDEN] ticketInfo={ticketInfo}
        // [LOTTERY HIDDEN] lotteryHistory={lotteryHistory}
        // [LOTTERY HIDDEN] serverTime={Date.now()}
      />
    </div>
  )
}
