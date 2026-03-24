import { getOrders } from '@/modules/admin'
import { AdminOrdersClient } from '@/modules/admin/components/AdminOrdersClient'

export default async function AdminOrdersPage() {
  const orders = await getOrders()

  return <AdminOrdersClient orders={orders} />
}
