'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingBag, Trophy, Users, Settings, LogOut, HelpCircle, Calendar } from 'lucide-react'

import { signOut } from '@/modules/auth/index.client'
import type { AuthUser } from '@/modules/auth/index.client'
import { DevUserSwitcher } from '@/modules/dev-tools/components/DevUserSwitcher'
import { CoinBalanceLive } from '@/components/CoinBalance'

const LS_KEY = 'day_off_last_seen_at'

interface SidebarProps {
  user: AuthUser | null
  balance: number
  showDevSwitcher?: boolean
  isMobileOpen?: boolean
  dayOffResolved?: string[]
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const navItems = [
  { href: '/',            label: 'Главная',       icon: Home },
  { href: '/store',       label: 'Магазин',       icon: ShoppingBag },
  { href: '/achievements',label: 'Достижения',    icon: Trophy },
  { href: '/activity',    label: 'Лента компании', icon: Users },
]

const bottomNavItems: { href: string; label: string; icon: typeof HelpCircle; adminOnly?: boolean }[] = [
  { href: '/day-off',     label: 'Запросить выходной', icon: Calendar },
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

export function Sidebar({ user, balance, showDevSwitcher, isMobileOpen = false, dayOffResolved = [], isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const [dayOffBadge, setDayOffBadge] = useState(0)

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY)
    const lastSeen = raw ? new Date(raw) : null

    if (!lastSeen) {
      // Первый запуск — считаем всё просмотренным
      localStorage.setItem(LS_KEY, new Date().toISOString())
      setDayOffBadge(0)
      return
    }

    const unseen = dayOffResolved.filter((ts) => new Date(ts) > lastSeen).length
    setDayOffBadge(unseen)
  }, [dayOffResolved])

  useEffect(() => {
    if (pathname.startsWith('/day-off')) {
      localStorage.setItem(LS_KEY, new Date().toISOString())
      setDayOffBadge(0)
    }
  }, [pathname])

  const collapsed = isCollapsed

  return (
    <aside
      className={`group/sidebar fixed left-0 top-0 bottom-0 flex flex-col z-40
        transition-[transform,width] duration-300 ease-in-out
        ${collapsed ? 'w-[68px]' : 'w-[260px]'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      style={{
        background: 'var(--apex-surface)',
        borderRight: '1px solid var(--apex-border)',
      }}
    >
      {/* Кликабельный правый бордер */}
      {onToggleCollapse && (
        <div
          onClick={onToggleCollapse}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          className="hidden md:block absolute right-0 top-0 bottom-0 w-[5px] cursor-pointer z-10 group/rail"
        >
          <div className="absolute right-0 top-0 bottom-0 w-px transition-all duration-150 group-hover/rail:w-[2px]"
            style={{ background: 'var(--apex-border)' }}
          />
          <div className="absolute right-0 top-0 bottom-0 w-[2px] opacity-0 group-hover/rail:opacity-100 transition-opacity duration-150"
            style={{ background: 'var(--apex-primary)' }}
          />
        </div>
      )}

      {/* Logo */}
      <div
        className={`flex items-center pt-6 pb-5 ${collapsed ? 'justify-center px-3' : 'pl-3.5 pr-4'}`}
        style={{ borderBottom: '1px solid var(--apex-border)' }}
      >
        <Link href="/" className={`flex items-center gap-1.5 ${collapsed ? '' : 'flex-1 min-w-0'}`}>
          <img src="/logo.svg" width={40} height={40} alt="" className="flex-shrink-0" />
          {!collapsed && (
            <div className="font-bold text-[14px] truncate" style={{ color: 'var(--apex-text)' }}>
              Геймификация
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                title={collapsed ? item.label : undefined}
                className={`flex items-center py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-150
                  ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'}`}
                style={{
                  background: isActive ? 'var(--apex-success-bg)' : 'transparent',
                  color: isActive ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
                  border: isActive
                    ? '1px solid rgba(var(--apex-primary-rgb), 0.2)'
                    : '1px solid transparent',
                }}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && item.label}
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
              const showBadge = item.href === '/day-off' && dayOffBadge > 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  data-onboarding={item.href === '/day-off' ? 'sidebar-day-off' : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-150
                    ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'}`}
                  style={{
                    background: isActive ? 'var(--apex-disabled-bg)' : 'transparent',
                    color: isActive ? 'var(--apex-text)' : 'var(--apex-text-muted)',
                    border: '1px solid transparent',
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <Icon size={16} />
                    {showBadge && collapsed && (
                      <span
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                        style={{ background: 'var(--apex-primary)' }}
                      />
                    )}
                  </div>
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {showBadge && (
                        <span
                          className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold text-white"
                          style={{ background: 'var(--apex-primary)' }}
                        >
                          {dayOffBadge > 9 ? '9+' : dayOffBadge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              )
            })}

          {showDevSwitcher && !collapsed && (
            <DevUserSwitcher
              isImpersonating={user?.isImpersonating ?? false}
              impersonatedName={user?.fullName ?? null}
            />
          )}
        </div>
      </nav>

      {/* Coin balance */}
      {collapsed ? (
        <div className="px-2 pb-3 flex justify-center" data-onboarding="sidebar-balance">
          <CoinBalanceLive initialAmount={balance} size="sm" />
        </div>
      ) : (
        <div className="pl-3 pr-5 pb-3">
          <div
            className="pt-3 pb-3 pl-5 pr-3 rounded-xl"
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
      )}

      {/* User profile */}
      <div className={`pb-6 ${collapsed ? 'px-2' : 'pl-3 pr-5'}`}>
        {collapsed ? (
          <div
            className="w-9 h-9 mx-auto rounded-full flex items-center justify-center text-white text-xs font-bold"
            title={user?.fullName || user?.email || undefined}
            style={{ background: 'var(--apex-primary)' }}
          >
            {user ? getInitials(user.fullName, user.email) : '?'}
          </div>
        ) : (
          <div
            className="flex items-center gap-3 pt-3 pb-3 pl-5 pr-3 rounded-xl"
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
        )}
      </div>
    </aside>
  )
}
