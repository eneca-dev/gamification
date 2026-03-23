'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Users, Search, X } from 'lucide-react'

import { setImpersonation, searchUsers } from '@/modules/dev-tools/actions'

import type { DevUser } from '../types'

export function DevUserSwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<DevUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Загрузить начальный список при открытии
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      searchUsers('').then((data) => {
        setUsers(data)
        setIsLoading(false)
      })
      // Фокус на поле поиска
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setSearch('')
      setUsers([])
    }
  }, [isOpen])

  // Debounced поиск
  useEffect(() => {
    if (!isOpen) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      setIsLoading(true)
      searchUsers(search).then((data) => {
        setUsers(data)
        setIsLoading(false)
      })
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, isOpen])

  function handleSelect(email: string) {
    startTransition(async () => {
      await setImpersonation(email)
      setIsOpen(false)
    })
  }

  const modal = isOpen ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-[480px] max-h-[70vh] rounded-2xl shadow-xl flex flex-col"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--apex-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--apex-border)' }}
        >
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--apex-text)' }}>
            Сменить пользователя (DEV)
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-full hover:bg-black/5 transition-colors"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Поиск */}
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--apex-border)' }}>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--apex-border)',
            }}
          >
            <Search size={14} style={{ color: 'var(--apex-text-muted)' }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Поиск по имени или email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--apex-text-muted)]"
              style={{ color: 'var(--apex-text)' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="p-0.5 rounded hover:bg-black/5"
                style={{ color: 'var(--apex-text-muted)' }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Список пользователей */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <div className="text-center py-8 text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
              Загрузка...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
              Пользователи не найдены
            </div>
          ) : (
            users.map((u) => (
              <button
                key={u.email}
                onClick={() => handleSelect(u.email)}
                disabled={isPending}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-black/[0.04] disabled:opacity-50"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                  style={{ background: 'var(--apex-primary)' }}
                >
                  {(u.firstName[0] ?? '') + (u.lastName[0] ?? '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: 'var(--apex-text)' }}>
                    {u.fullName}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--apex-text-muted)' }}>
                    {u.departmentCode ?? u.department ?? '—'}
                    {u.team ? ` / ${u.team}` : ''}
                    <span className="ml-2 opacity-60">{u.email}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Футер */}
        <div
          className="px-5 py-3 text-[11px]"
          style={{
            color: 'var(--apex-text-muted)',
            borderTop: '1px solid var(--apex-border)',
          }}
        >
          {users.length > 0 && `Показано ${users.length} из 573 сотрудников`}
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {/* Кнопка открытия */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 w-full px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-150"
        style={{
          background: 'transparent',
          color: 'var(--apex-text-muted)',
          border: '1px solid transparent',
        }}
        title="Сменить пользователя (DEV)"
      >
        <Users size={16} />
        Сменить юзера
      </button>

      {/* Портал — рендерим модалку в body, чтобы она не обрезалась sidebar */}
      {modal && createPortal(modal, document.body)}
    </>
  )
}
