import { Users } from 'lucide-react'

import { AdminPlaceholder } from '@/modules/admin/components/AdminPlaceholder'

export default function AdminUsersPage() {
  return (
    <AdminPlaceholder
      icon={Users}
      title="Пользователи"
      description="Раздел будет доступен в следующем обновлении"
    />
  )
}
