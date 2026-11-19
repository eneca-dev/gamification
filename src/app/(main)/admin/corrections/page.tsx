import { redirect } from 'next/navigation'

import { checkIsAdmin } from '@/modules/admin'
import { getCorrectionUsers } from '@/modules/corrections'
import { CorrectionsUsersTable } from '@/modules/corrections/components/CorrectionsUsersTable'

export default async function AdminCorrectionsPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const users = await getCorrectionUsers()

  return <CorrectionsUsersTable users={users} />
}
