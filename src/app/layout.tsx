import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Геймификация — Система баллов',
  description: 'Корпоративная система геймификации',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  )
}
