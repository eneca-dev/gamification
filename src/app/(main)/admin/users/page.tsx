import { getUsers } from '@/modules/admin'
import { AdminUsersClient } from '@/modules/admin/components/AdminUsersClient'

export default async function AdminUsersPage() {
  const users = await getUsers()

  return <AdminUsersClient users={users} />
}
