import { Package } from 'lucide-react'

import { AdminPlaceholder } from '@/modules/admin/components/AdminPlaceholder'

export default function AdminProductsPage() {
  return (
    <AdminPlaceholder
      icon={Package}
      title="Товары"
      description="Раздел будет доступен в следующем обновлении"
    />
  )
}
