import { getAllHelpArticles } from '@/modules/help'
import { HelpEditor } from '@/modules/help/components/HelpEditor'

interface AdminHelpEditPageProps {
  params: Promise<{ slug: string }>
}

export default async function AdminHelpEditPage({ params }: AdminHelpEditPageProps) {
  const { slug } = await params

  const isNew = slug === 'new'

  let article = null
  if (!isNew) {
    const articles = await getAllHelpArticles()
    article = articles.find((a) => a.slug === slug) ?? null
  }

  if (!isNew && !article) {
    return (
      <div className="py-12 text-center">
        <div className="text-3xl mb-3">🔍</div>
        <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
          Статья не найдена
        </div>
      </div>
    )
  }

  return (
    <HelpEditor
      article={article ? {
        slug: article.slug,
        title: article.title,
        content: article.content,
        folder: article.folder,
        folder_label: article.folder_label,
        is_published: article.is_published,
      } : null}
      isNew={isNew}
    />
  )
}
