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
      <div className="space-y-5">
        {/* Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2">
            <HelpCircle size={20} style={{ color: 'var(--apex-primary)' }} />
            <h1 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Справка
            </h1>
          </div>
          <p className="text-[13px] font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
            Как работает система геймификации
          </p>
        </div>

        {/* Layout: sidebar + content */}
        <div className="animate-fade-in-up stagger-1 flex gap-6">
          {/* Sidebar */}
          <div
            className="w-[260px] shrink-0 rounded-2xl p-4 self-start sticky top-4"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
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
