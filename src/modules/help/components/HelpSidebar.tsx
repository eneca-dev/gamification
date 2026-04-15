'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, FolderOpen, FolderClosed } from 'lucide-react'

import { useHelpSearch } from './HelpSearchContext'
import type { HelpFolder } from '../types'

interface HelpSidebarProps {
  folders: HelpFolder[]
}

export function HelpSidebar({ folders }: HelpSidebarProps) {
  const pathname = usePathname()
  const { query } = useHelpSearch()

  // Папка открыта, если в ней есть активная статья
  const initialOpen = new Set(
    folders
      .filter((f) => f.articles.some((a) => pathname === `/help/${a.slug}`))
      .map((f) => f.folder)
  )
  if (initialOpen.size === 0 && folders.length > 0) {
    initialOpen.add(folders[0].folder)
  }

  const [openFolders, setOpenFolders] = useState<Set<string>>(initialOpen)

  // Фильтрация при поиске
  const filteredFolders = useMemo(() => {
    if (query.length < 2) return null // null = показать всё как обычно
    const q = query.toLowerCase()
    return folders
      .map((folder) => ({
        ...folder,
        articles: folder.articles.filter(
          (a) => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
        ),
      }))
      .filter((folder) => folder.articles.length > 0)
  }, [folders, query])

  function toggleFolder(folder: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  // При поиске — все папки открыты, показываем только совпадения
  const isSearching = filteredFolders !== null
  const displayFolders = filteredFolders ?? folders

  if (isSearching && displayFolders.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <div className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
          Ничего не найдено
        </div>
      </div>
    )
  }

  return (
    <nav className="space-y-0.5">
      {displayFolders.map((folder) => {
        const isOpen = isSearching || openFolders.has(folder.folder)
        return (
          <div key={folder.folder}>
            <button
              onClick={() => !isSearching && toggleFolder(folder.folder)}
              className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors text-left"
              style={{ color: 'var(--text-primary)' }}
            >
              {isOpen ? (
                <FolderOpen size={15} className="shrink-0" style={{ color: 'var(--apex-primary)' }} />
              ) : (
                <FolderClosed size={15} className="shrink-0" style={{ color: 'var(--apex-primary)' }} />
              )}
              {folder.folder_label}
            </button>

            {isOpen && (
              <div className="ml-2 space-y-0.5 mt-0.5">
                {folder.articles.map((article) => {
                  const href = `/help/${article.slug}`
                  const isActive = pathname === href
                  return (
                    <Link
                      key={article.slug}
                      href={href}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
                      style={{
                        background: isActive ? 'var(--apex-success-bg)' : 'transparent',
                        color: isActive ? 'var(--apex-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      <FileText size={13} className="shrink-0" style={{ color: 'var(--apex-primary)' }} />
                      <span className="truncate">{article.title}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
