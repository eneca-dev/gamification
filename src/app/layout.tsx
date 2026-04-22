import type { Metadata } from 'next'
import { QueryProvider } from '@/modules/cache'
import './globals.css'

export const metadata: Metadata = {
  title: 'Геймификация',
  description: 'Корпоративная система геймификации',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
