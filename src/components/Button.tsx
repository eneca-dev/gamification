// Единая кнопка проекта. Нужна потому, что одни и те же стили были скопированы
// в магазин, витрину Бимо и админский импортер, и расходились при правках.
// Формы и размеры повторяют действующий магазин, цвета берутся из Apex-переменных.

import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  children: ReactNode
}

const BASE = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--apex-focus)] disabled:cursor-default'

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[11px]',
  md: 'px-4 py-2.5 text-[12px]',
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--apex-primary)] text-white enabled:hover:bg-[var(--apex-primary-hover)] disabled:bg-[var(--apex-disabled-bg)] disabled:text-[var(--apex-text-muted)] disabled:border disabled:border-[var(--apex-border)]',
  secondary: 'bg-[var(--apex-surface)] text-[var(--apex-text)] border border-[var(--apex-border)] enabled:hover:border-[var(--apex-primary)] disabled:opacity-50',
  ghost: 'bg-transparent text-[var(--apex-text-secondary)] enabled:hover:text-[var(--apex-text)] disabled:opacity-50',
  danger: 'bg-transparent text-[var(--apex-danger)] border border-[var(--apex-danger-light)] enabled:hover:bg-[var(--apex-error-bg)] disabled:opacity-50',
}

export function Button({ variant = 'secondary', size = 'md', fullWidth = false, className = '', type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`} {...rest}>
      {children}
    </button>
  )
}
