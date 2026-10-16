import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/modules/auth'
import { getProducts, getCategories, getUserBalance } from '@/modules/shop'
import { getShieldQuota, getShieldCredits } from '@/modules/streak-shield'
// [LOTTERY HIDDEN] import { getActiveLottery, getLotteryHistory, getUserTicketInfo } from '@/modules/lottery'
import { StoreClient } from '@/modules/shop/components/StoreClient'
// [LOTTERY HIDDEN] import { LotteryReveal } from '@/modules/lottery/components/LotteryReveal'

export default async function StorePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [products, categories, balance, shieldQuota, shieldCredits] = await Promise.all([
    getProducts(),
    getCategories(),
    user.wsUserId ? getUserBalance(user.wsUserId) : Promise.resolve(0),
    user.wsUserId ? getShieldQuota(user.wsUserId) : Promise.resolve(null),
    user.wsUserId ? getShieldCredits(user.wsUserId) : Promise.resolve({ ws: 0, revit: 0 }),
    // [LOTTERY HIDDEN] getActiveLottery(),
    // [LOTTERY HIDDEN] getLotteryHistory(),
  ])

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
