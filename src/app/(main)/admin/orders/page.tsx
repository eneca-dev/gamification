import { ShoppingBag } from 'lucide-react'

import { AdminPlaceholder } from '@/modules/admin/components/AdminPlaceholder'

export default function AdminOrdersPage() {
  return (
    <AdminPlaceholder
      icon={ShoppingBag}
      title="Заказы"
      description="Раздел будет доступен в следующем обновлении"
    />
  )
}
