import Link from 'next/link'
import { Bot, FileText, Pencil, Eye, EyeOff, Layers, Plus } from 'lucide-react'

import { getChatbotArticlesWithChunks } from '@/modules/help'
import { ReembedButton } from '@/modules/help/components/ReembedButton'

export default async function AdminChatbotPage() {
  const articles = await getChatbotArticlesWithChunks()

  const totalChunks = articles.reduce((sum, a) => sum + a.chunks.length, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Bot size={18} style={{ color: 'var(--apex-primary)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>
              База знаний чат-бота
            </h2>
          </div>
          <p className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {articles.length} {articles.length === 1 ? 'статья' : articles.length >= 2 && articles.length <= 4 ? 'статьи' : 'статей'} · {totalChunks} чанков
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReembedButton />
          <Link
            href="/admin/help/new/edit"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-white transition-colors"
            style={{ background: 'var(--apex-primary)' }}
          >
            <Plus size={15} />
            Новая статья
          </Link>
        </div>
      </div>

      {articles.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl text-center"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <Bot size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Статей пока нет
          </p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Создайте статью и выберите папку «Чат-бот: определения»
          </p>
        </div>
      )}

      <div className="space-y-4">
        {articles.map((article) => (
          <div
            key={article.slug}
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {/* Article header */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: 'var(--surface-elevated)', borderBottom: article.chunks.length > 0 ? '1px solid var(--border)' : undefined }}
            >
              <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {article.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    /{article.slug}
                  </span>
                  <span
                    className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
                  >
                    <Layers size={10} />
                    {article.chunks.length} чанков
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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

            {/* Chunks */}
            {article.chunks.length > 0 && (
              <div style={{ background: 'var(--surface)' }}>
                {article.chunks.map((chunk, i) => (
                  <div
                    key={chunk.id}
                    className="px-4 py-3 text-[12px] font-mono leading-relaxed"
                    style={{
                      color: 'var(--text-secondary)',
                      borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className="inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}
                      >
                        #{chunk.chunk_index + 1}
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {new Date(chunk.created_at).toLocaleString('ru-RU', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {chunk.content}
                  </div>
                ))}
              </div>
            )}

            {article.chunks.length === 0 && article.is_published && (
              <div
                className="px-4 py-3 text-[12px] font-medium"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
              >
                Чанков нет — запустите векторизацию после сохранения статьи
              </div>
            )}

            {!article.is_published && (
              <div
                className="px-4 py-3 text-[12px] font-medium"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
              >
                Статья не опубликована — чанки не генерируются
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
