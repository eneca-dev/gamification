import { redirect } from 'next/navigation'
import { checkIsAdmin } from '@/modules/admin'
import { getAllNews, getNewsDepartments } from '@/modules/news/queries'
import { NewsAdmin } from '@/modules/news/components/NewsAdmin'

export default async function AdminNewsPage() {
  if (!await checkIsAdmin()) redirect('/')
  const [news, departments] = await Promise.all([getAllNews(), getNewsDepartments()])
  return <NewsAdmin items={news.items} departments={departments} now={news.now} />
}
