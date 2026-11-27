'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

// Единый выпадающий список проекта. Нативный <select> выглядит по-разному
// в каждой системе и не умеет отметку выбранного пункта, поэтому форма товара
// держала свой список. Теперь он общий: тем же пользуются карточка товара
// и импортёр вещей Бимо.

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  /** Непустая строка подсвечивает поле как ошибочное. */
  error?: string
  disabled?: boolean
  /** Подпись для скринридера, если рядом нет видимого <label>. */
  ariaLabel?: string
}

const FIELD_CLASS = 'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] outline-none transition-colors disabled:cursor-default disabled:opacity-60'

export function Select({ value, onChange, options, placeholder = 'Выберите', error, disabled = false, ariaLabel }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.value === value)

  useEffect(() => {
    if (!isOpen) return
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false)
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        className={FIELD_CLASS}
        style={{
          background: 'var(--apex-bg)',
          border: `1px solid ${error ? 'var(--apex-danger)' : 'var(--apex-border)'}`,
          color: 'var(--apex-text)',
        }}
      >
        <span style={{ color: selected ? 'var(--apex-text)' : 'var(--apex-text-muted)' }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--apex-text-muted)' }} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl py-1.5 shadow-lg"
          style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
        >
          {options.map(option => {
            const isSelected = option.value === value
            return (
              <button
                type="button"
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(option.value); setIsOpen(false) }}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-[12px] font-medium transition-colors"
                style={{
                  color: isSelected ? 'var(--apex-primary)' : 'var(--apex-text)',
                  background: isSelected ? 'var(--apex-success-bg)' : 'transparent',
                }}
                onMouseEnter={event => { if (!isSelected) event.currentTarget.style.background = 'var(--apex-bg)' }}
                onMouseLeave={event => { if (!isSelected) event.currentTarget.style.background = 'transparent' }}
              >
                {option.label}
                {isSelected && <Check size={14} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
