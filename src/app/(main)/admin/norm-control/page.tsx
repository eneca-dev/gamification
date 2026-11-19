import { redirect } from 'next/navigation'

export default async function NormControlRedirect({ searchParams }: {
  searchParams: Promise<{ month?: string | string[] }>
}) {
  const rawMonth = (await searchParams).month
  const month = Array.isArray(rawMonth) ? rawMonth[0] : rawMonth
  const query = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? `?normMonth=${month}` : ''
  redirect(`/admin/achievements${query}#norm-control`)
}
