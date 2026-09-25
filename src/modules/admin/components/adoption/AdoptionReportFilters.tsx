'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

import { DatePicker } from '@/components/DatePicker'
import type { AdoptionCohortScope } from '@/modules/admin'

interface Props {
  month: string
  scope: AdoptionCohortScope
  selectedDepartments: string[]
  departments: string[]
}

const scopes: { value: AdoptionCohortScope; label: string }[] = [
  { value: 'designer', label: 'Проектировщики' },
  { value: 'all', label: 'Все сотрудники' },
  { value: 'selected', label: 'Выбранные отделы' },
]

const monthNames = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  return `${monthNames[month - 1]} ${year}`
}

export function AdoptionReportFilters({ month, scope, selectedDepartments, departments }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [draftDepartments, setDraftDepartments] = useState(selectedDepartments)
  const [search, setSearch] = useState('')

  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key)
      else params.set(key, value)
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const toggleDepartment = (department: string) => {
    setDraftDepartments((current) => current.includes(department)
      ? current.filter((item) => item !== department)
      : [...current, department].sort((a, b) => a.localeCompare(b, 'ru')))
  }
  const filteredDepartments = departments.filter((department) => department.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')))

  return (
    <div
      className={`rounded-2xl p-3 flex flex-wrap items-center gap-2.5 transition-opacity ${isPending ? 'opacity-70' : ''}`}
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="shrink-0">
        <DatePicker
          value={`${month}-01`}
          onChange={(value) => { if (value) update({ month: value.slice(0, 7) }) }}
          formatValue={() => formatMonth(month)}
          placeholder="Выберите месяц"
          tone="success"
          triggerVariant="pill"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {scopes.map((item) => (
          <button
            key={item.value}
            onClick={() => update({ scope: item.value })}
            className="px-3 py-1 rounded-full text-[12px] transition-all"
            style={{
              background: scope === item.value ? 'var(--apex-success-bg)' : 'transparent',
              color: scope === item.value ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
              border: `1px solid ${scope === item.value ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
              fontWeight: scope === item.value ? 600 : 500,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {scope === 'selected' && (
        <details className="basis-full rounded-xl p-3 text-[12px]" style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }} open>
          <summary className="cursor-pointer font-semibold" style={{ color: 'var(--apex-text-secondary)' }}>
            Выбрано отделов: {draftDepartments.length}
          </summary>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти отдел" className="min-w-[220px] flex-1 rounded-lg px-3 py-2 outline-none" style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', color: 'var(--apex-text)' }} />
            <button type="button" onClick={() => setDraftDepartments([...departments])} className="rounded-lg px-3 py-2 font-medium" style={{ color: 'var(--apex-primary)', border: '1px solid var(--apex-border)' }}>Выбрать все</button>
            <button type="button" onClick={() => setDraftDepartments([])} className="rounded-lg px-3 py-2 font-medium" style={{ color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)' }}>Снять выбор</button>
          </div>
          <div className="mt-3 max-h-[260px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5 pr-1">
            {filteredDepartments.map((department) => (
              <label key={department} className="flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer" style={{ color: 'var(--apex-text)', background: draftDepartments.includes(department) ? 'var(--apex-success-bg)' : 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
                <input
                  type="checkbox"
                  checked={draftDepartments.includes(department)}
                  onChange={() => toggleDepartment(department)}
                  className="accent-[var(--apex-primary)]"
                />
                <span className="truncate">{department}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end"><button type="button" disabled={isPending} onClick={() => update({ scope: 'selected', departments: draftDepartments.length ? draftDepartments.join(',') : null })} className="rounded-lg px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-60" style={{ background: 'var(--apex-primary)' }}>Применить</button></div>
        </details>
      )}
    </div>
  )
}
