import { notFound, redirect } from 'next/navigation'

import { checkIsAdmin } from '@/modules/admin'
import { getCorrectionUserDetail } from '@/modules/corrections'
import { CorrectionDetailShell } from '@/modules/corrections/components/CorrectionDetailShell'

interface CorrectionUserPageProps {
  params: Promise<{ id: string }>
}

export default async function CorrectionUserPage({ params }: CorrectionUserPageProps) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const { id } = await params
  const detail = await getCorrectionUserDetail(id)
  if (!detail) notFound()

  return <CorrectionDetailShell initialDetail={detail} />
}
