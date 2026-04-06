import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/modules/auth'
import { getProducts, getCategories, getUserBalance } from '@/modules/shop'
import { getPendingResets } from '@/modules/streak-shield'
import { getActiveLottery, getLotteryHistory, getUserTicketInfo } from '@/modules/lottery'
import { StoreClient } from '@/modules/shop/components/StoreClient'
import { LotteryReveal } from '@/modules/lottery/components/LotteryReveal'

export default async function StorePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [products, categories, balance, pendingResets, activeLottery, lotteryHistory] = await Promise.all([
    getProducts(),
    getCategories(),
    user.wsUserId ? getUserBalance(user.wsUserId) : Promise.resolve(0),
    user.wsUserId ? getPendingResets(user.wsUserId) : Promise.resolve([]),
    getActiveLottery(),
    getLotteryHistory(),
  ])

  // Билеты текущего пользователя (если есть активная лотерея)
  const ticketInfo = activeLottery && user.wsUserId
    ? await getUserTicketInfo(user.wsUserId, activeLottery.product_id)
    : null

  // Последняя завершённая лотерея — для reveal-анимации
  const lastCompleted = lotteryHistory[0] ?? null
  const wasParticipant = lastCompleted && user.wsUserId
    ? (await getUserTicketInfo(user.wsUserId, lastCompleted.product_id)).ticket_count > 0
    : false

  // Фильтруем товар-билет из основной сетки (он показывается в секции лотереи)
  const filteredProducts = activeLottery
    ? products.filter((p) => p.id !== activeLottery.product_id)
    : products

  return (
    <div className="space-y-6">
      {/* Reveal-анимация для участников (показывается 1 раз) */}
      {lastCompleted && (
        <LotteryReveal lottery={lastCompleted} wasParticipant={wasParticipant} />
      )}

      {/* Магазин с лотереей внутри категории "Розыгрыши" */}
      <StoreClient
        products={filteredProducts}
        categories={categories}
        balance={balance}
        pendingResets={pendingResets}
        activeLottery={activeLottery}
        ticketInfo={ticketInfo}
        lotteryHistory={lotteryHistory}
        serverTime={Date.now()}
      />
    </div>
  )
}
