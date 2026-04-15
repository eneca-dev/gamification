import { notFound } from 'next/navigation'

import { getHelpArticle } from '@/modules/help'
import { HelpContent } from '@/modules/help/components/HelpContent'

interface HelpArticlePageProps {
  params: Promise<{ slug: string }>
}

export default async function HelpArticlePage({ params }: HelpArticlePageProps) {
  const { slug } = await params
  const article = await getHelpArticle(slug)

  if (!article) {
    notFound()
  }

  return (
    <HelpContent
      title={article.title}
      content={article.content}
      updatedAt={article.updated_at}
    />
  )
}
