import { getAllLotteries } from '@/modules/lottery'
import { LotteryAdmin } from '@/modules/admin/components/LotteryAdmin'

export default async function AdminLotteryPage() {
  const lotteries = await getAllLotteries()

  return <LotteryAdmin lotteries={lotteries} />
}
