import { redirect } from 'next/navigation'

import { getHelpArticles } from '@/modules/help'

export default async function HelpPage() {
  const articles = await getHelpArticles()

  if (articles.length > 0) {
    redirect(`/help/${articles[0].slug}`)
  }

  return (
    <div className="py-12 text-center">
      <div className="text-3xl mb-3">📖</div>
      <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
        Справка пуста
      </div>
      <div className="text-[12px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
        Статьи ещё не добавлены
      </div>
    </div>
  )
}
