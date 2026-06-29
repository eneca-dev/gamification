import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/modules/auth'
import { getProducts, getCategories, getUserBalance } from '@/modules/shop'
import { getPendingResets, getShieldQuota } from '@/modules/streak-shield'
// [LOTTERY HIDDEN] import { getActiveLottery, getLotteryHistory, getUserTicketInfo } from '@/modules/lottery'
import { StoreClient } from '@/modules/shop/components/StoreClient'
// [LOTTERY HIDDEN] import { LotteryReveal } from '@/modules/lottery/components/LotteryReveal'

export default async function StorePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [products, categories, balance, pendingResets, shieldQuota] = await Promise.all([
    getProducts(),
    getCategories(),
    user.wsUserId ? getUserBalance(user.wsUserId) : Promise.resolve(0),
    user.wsUserId ? getPendingResets(user.wsUserId) : Promise.resolve([]),
    user.wsUserId ? getShieldQuota(user.wsUserId) : Promise.resolve(null),
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
        pendingResets={pendingResets}
        shieldQuota={shieldQuota}
        // [LOTTERY HIDDEN] activeLottery={activeLottery}
        // [LOTTERY HIDDEN] ticketInfo={ticketInfo}
        // [LOTTERY HIDDEN] lotteryHistory={lotteryHistory}
        // [LOTTERY HIDDEN] serverTime={Date.now()}
      />
    </div>
  )
}
