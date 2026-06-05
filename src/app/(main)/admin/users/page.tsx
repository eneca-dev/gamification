import { redirect } from 'next/navigation'

import { checkIsAdmin, getUsers } from '@/modules/admin'
import { AdminUsersClient } from '@/modules/admin/components/AdminUsersClient'

export default async function AdminUsersPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const users = await getUsers()

  return <AdminUsersClient users={users} />
}
