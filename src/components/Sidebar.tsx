'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingBag, Trophy, Users, Settings, LogOut, HelpCircle } from 'lucide-react'

import { signOut } from '@/modules/auth/index.client'
import type { AuthUser } from '@/modules/auth/index.client'
import { DevUserSwitcher } from '@/modules/dev-tools/components/DevUserSwitcher'
import { CoinBalanceLive } from '@/components/CoinBalance'

interface SidebarProps {
  user: AuthUser | null
  balance: number
  showDevSwitcher?: boolean
}

const navItems = [
  { href: '/',            label: 'Главная',       icon: Home },
  { href: '/store',       label: 'Магазин',       icon: ShoppingBag },
  { href: '/achievements',label: 'Достижения',    icon: Trophy },
  { href: '/activity',    label: 'Лента компании', icon: Users },
]

const bottomNavItems: { href: string; label: string; icon: typeof HelpCircle; adminOnly?: boolean }[] = [
  { href: '/help',        label: 'Справка',       icon: HelpCircle },
  { href: '/admin',       label: 'Админ-панель',  icon: Settings, adminOnly: true },
]

function getInitials(fullName: string, email?: string): string {
  const parts = fullName.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  // Нет имени — берём первые 2 буквы email
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return '?'
}

export function Sidebar({ user, balance, showDevSwitcher }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[260px] flex flex-col"
      style={{
        background: 'var(--apex-surface)',
        borderRight: '1px solid var(--apex-border)',
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        className="block px-6 pt-6 pb-5"
        style={{ borderBottom: '1px solid var(--apex-border)' }}
      >
        <div className="flex items-center gap-1.5">
          <img src="/logo.svg" width={40} height={40} alt="" className="flex-shrink-0" />
          <div className="font-bold text-[14px]" style={{ color: 'var(--apex-text)' }}>
            Геймификация
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-150"
                style={{
                  background: isActive ? 'var(--apex-success-bg)' : 'transparent',
                  color: isActive ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
                  border: isActive
                    ? '1px solid rgba(var(--apex-primary-rgb), 0.2)'
                    : '1px solid transparent',
                }}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Нижняя секция: справка + админ */}
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--apex-border)' }}>
          {bottomNavItems
            .filter((item) => !item.adminOnly || user?.isAdmin)
            .map((item) => {
              const isActive = item.href === '/help'
                ? pathname.startsWith('/help')
                : pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-150"
                  style={{
                    background: isActive ? 'var(--apex-disabled-bg)' : 'transparent',
                    color: isActive ? 'var(--apex-text)' : 'var(--apex-text-muted)',
                    border: '1px solid transparent',
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          {showDevSwitcher && <DevUserSwitcher />}
        </div>
      </nav>

      {/* Coin balance */}
      <div className="px-4 pb-3">
        <div
          className="p-3 rounded-xl"
          data-onboarding="sidebar-balance"
          style={{
            background: 'var(--apex-success-bg)',
            border: '1px solid var(--apex-border)',
          }}
        >
          <div className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--apex-text-muted)' }}>
            На вашем счету
          </div>
          <CoinBalanceLive initialAmount={balance} size="md" />
        </div>
      </div>

      {/* User profile */}
      <div className="px-4 pb-6">
        <div
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{
            background: 'var(--apex-bg)',
            border: '1px solid var(--apex-border)',
          }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--apex-primary)' }}
          >
            {user ? getInitials(user.fullName, user.email) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--apex-text)' }}>
              {user?.fullName || user?.email?.split('@')[0] || '—'}
            </div>
            <div className="text-[11px] truncate" style={{ color: 'var(--apex-text-muted)' }}>
              {user?.email ?? ''}
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title="Выйти"
              className="p-1.5 rounded-full transition-colors hover:bg-black/5"
              style={{ color: 'var(--apex-text-muted)' }}
            >
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
