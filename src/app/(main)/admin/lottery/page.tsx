import { getAllLotteries } from '@/modules/lottery'
import { getCurrentRate } from '@/modules/shop'
import { LotteryAdmin } from '@/modules/admin/components/LotteryAdmin'

export default async function AdminLotteryPage() {
  const [lotteries, rate] = await Promise.all([getAllLotteries(), getCurrentRate()])

  return <LotteryAdmin lotteries={lotteries} rate={rate} />
}
