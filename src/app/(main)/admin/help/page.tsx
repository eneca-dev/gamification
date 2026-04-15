import Link from 'next/link'
import { FileText, Pencil, Plus, Eye, EyeOff } from 'lucide-react'

import { getAllHelpArticles } from '@/modules/help'

export default async function AdminHelpPage() {
  const articles = await getAllHelpArticles()

  // Группировка по папкам
  const folders = new Map<string, { label: string; articles: typeof articles }>()
  for (const a of articles) {
    if (!folders.has(a.folder)) {
      folders.set(a.folder, { label: a.folder_label, articles: [] })
    }
    folders.get(a.folder)!.articles.push(a)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Управление справкой
          </h2>
          <p className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {articles.length} {articles.length === 1 ? 'статья' : articles.length >= 2 && articles.length <= 4 ? 'статьи' : 'статей'}
          </p>
        </div>
        <Link
          href="/admin/help/new/edit"
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-white transition-colors"
          style={{ background: 'var(--apex-primary)' }}
        >
          <Plus size={15} />
          Новая статья
        </Link>
      </div>

      {[...folders.entries()].map(([folder, { label, articles: folderArticles }]) => (
        <div key={folder}>
          <div
            className="text-[11px] font-bold uppercase tracking-wider mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {label}
          </div>
          <div className="space-y-1.5">
            {folderArticles.map((article) => (
              <div
                key={article.slug}
                className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                }}
              >
                <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {article.title}
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    /{article.slug}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {article.is_published ? (
                    <Eye size={14} style={{ color: 'var(--apex-primary)' }} />
                  ) : (
                    <EyeOff size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <Link
                    href={`/admin/help/${article.slug}/edit`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
                    style={{
                      background: 'var(--surface)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <Pencil size={12} />
                    Изменить
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
