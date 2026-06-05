import { redirect } from 'next/navigation'

import { checkIsAdmin, getOrders } from '@/modules/admin'
import { AdminOrdersClient } from '@/modules/admin/components/AdminOrdersClient'

export default async function AdminOrdersPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const orders = await getOrders()

  return <AdminOrdersClient orders={orders} />
}
