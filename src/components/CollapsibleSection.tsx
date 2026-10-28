'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import type { ReactNode } from 'react'

interface CollapsibleSectionProps {
  header: ReactNode
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({ header, summary, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 rounded-lg py-1 text-left hover:bg-[var(--apex-bg)]"
      >
        <ChevronDown
          size={14}
          className={`shrink-0 text-[var(--apex-text-muted)] transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
        <span className="flex min-w-0 flex-1 items-center gap-1.5">{header}</span>
        {summary && <span className="shrink-0 text-[11px] font-medium text-[var(--apex-text-muted)]">{summary}</span>}
      </button>
      <div
        id={contentId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
