import { redirect } from 'next/navigation'

import { checkIsAdmin } from '@/modules/admin'
import { getAllLotteries } from '@/modules/lottery'
import { getCurrentRate } from '@/modules/shop'
import { LotteryAdmin } from '@/modules/admin/components/LotteryAdmin'

export default async function AdminLotteryPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const [lotteries, rate] = await Promise.all([getAllLotteries(), getCurrentRate()])

  return <LotteryAdmin lotteries={lotteries} rate={rate} />
}
