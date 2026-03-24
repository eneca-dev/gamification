import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/modules/auth'
import { getUserOrders } from '@/modules/shop'
import { OrdersClient } from '@/modules/shop/components/OrdersClient'

export default async function StoreOrdersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.wsUserId) redirect('/store')

  const orders = await getUserOrders(user.wsUserId)

  return <OrdersClient orders={orders} />
}
