import { redirect } from 'next/navigation'

import { checkIsAdmin } from '@/modules/admin'
import { getAllHelpArticles, getAllHelpFolders, getHelpVariablesMeta } from '@/modules/help'
import { HelpEditor } from '@/modules/help/components/HelpEditor'

interface AdminHelpEditPageProps {
  params: Promise<{ slug: string }>
}

export default async function AdminHelpEditPage({ params }: AdminHelpEditPageProps) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const { slug } = await params

  const isNew = slug === 'new'

  const [articles, variables, folders] = await Promise.all([
    isNew ? Promise.resolve([]) : getAllHelpArticles(),
    getHelpVariablesMeta(),
    getAllHelpFolders(),
  ])

  const article = isNew ? null : (articles.find((a) => a.slug === slug) ?? null)

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
        folder_id: article.folder.id,
        is_published: article.is_published,
      } : null}
      isNew={isNew}
      variables={variables}
      folders={folders}
    />
  )
}
