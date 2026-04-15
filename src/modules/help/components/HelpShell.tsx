'use client'

import { HelpCircle } from 'lucide-react'

import { HelpSearchProvider } from './HelpSearchContext'
import { HelpSearchInput } from './HelpSearchInput'
import { HelpSidebar } from './HelpSidebar'
import type { HelpFolder } from '../types'

interface HelpShellProps {
  folders: HelpFolder[]
  children: React.ReactNode
}

export function HelpShell({ folders, children }: HelpShellProps) {
  return (
    <HelpSearchProvider>
      <div className="-mt-3">
        {/* Header */}
        <div className="animate-fade-in-up mb-2">
          <div className="flex items-center gap-2">
            <HelpCircle size={18} style={{ color: 'var(--apex-primary)' }} />
            <h1 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Справка
            </h1>
          </div>
          <p className="text-[13px] font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
            Как работает система геймификации
          </p>
        </div>

        {/* Layout: sidebar + content */}
        <div className="animate-fade-in-up stagger-1 flex gap-6" style={{ minHeight: 'calc(100vh - 140px)' }}>
          {/* Sidebar */}
          <div
            className="w-[260px] shrink-0 rounded-2xl p-4 sticky top-4"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              alignSelf: 'stretch',
            }}
          >
            <div className="mb-3">
              <HelpSearchInput />
            </div>
            <HelpSidebar folders={folders} />
          </div>

          {/* Content */}
          <div
            className="flex-1 min-w-0 rounded-2xl p-6"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </HelpSearchProvider>
  )
}
