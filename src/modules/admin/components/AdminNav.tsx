'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Users, Package, ShoppingBag, Zap } from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Обзор', icon: BarChart3, exact: true },
  { href: '/admin/events', label: 'События', icon: Zap, exact: false },
  { href: '/admin/users', label: 'Пользователи', icon: Users, exact: false },
  { href: '/admin/products', label: 'Товары', icon: Package, exact: false },
  { href: '/admin/orders', label: 'Заказы', icon: ShoppingBag, exact: false },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1.5 flex-wrap">
      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150"
            style={{
              background: isActive ? 'var(--apex-success-bg)' : 'transparent',
              color: isActive ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
              border: isActive
                ? '1px solid var(--apex-primary)'
                : '1px solid transparent',
              fontWeight: isActive ? 600 : 500,
            }}
          >
            <Icon size={15} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
