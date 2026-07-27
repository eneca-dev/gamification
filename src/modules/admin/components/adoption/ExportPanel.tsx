'use client'

import { useMemo, useState, useTransition } from 'react'

import { Download, Search, X } from 'lucide-react'

import { DateRangePicker } from '@/components/DateRangePicker'

import type { ExportOptions, ReportType } from '@/modules/admin/export/types'

interface Props {
  options: ExportOptions
}

const TYPE_LABELS: { value: ReportType; label: string }[] = [
  { value: 'employee', label: 'По сотруднику' },
  { value: 'department', label: 'По отделу' },
  { value: 'company', label: 'По компании' },
]

// вчера в формате YYYY-MM-DD
function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function TypeChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-[12px] transition-all"
      style={{
        background: active ? 'var(--apex-success-bg)' : 'transparent',
        color: active ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
        border: `1px solid ${active ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  )
}

// Поиск сотрудника по ФИО (комбобокс)
function EmployeeSelect({ options, value, onChange }: { options: ExportOptions['employees']; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find((e) => e.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? options.filter((e) => e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q)) : options).slice(0, 50)
  }, [query, options])

  return (
    <div className="relative w-[280px]">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}>
        <Search size={13} style={{ color: 'var(--apex-text-muted)' }} />
        <input
          value={open ? query : selected?.name ?? ''}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setOpen(true); setQuery('') }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Найти сотрудника…"
          className="flex-1 bg-transparent text-[12px] outline-none"
          style={{ color: 'var(--apex-text)' }}
        />
        {selected && !open && (
          <button onClick={() => onChange('')} className="shrink-0"><X size={12} style={{ color: 'var(--apex-text-muted)' }} /></button>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full max-h-[240px] overflow-y-auto rounded-xl z-50 py-1" style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {filtered.length === 0 && <div className="px-3 py-2 text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>Никого не найдено</div>}
          {filtered.map((e) => (
            <button
              key={e.id}
              onMouseDown={() => { onChange(e.id); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--apex-bg)]"
            >
              <span className="block text-[12px]" style={{ color: 'var(--apex-text)' }}>{e.name}</span>
              <span className="block text-[10px] truncate" style={{ color: 'var(--apex-text-muted)' }}>{e.department}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ExportPanel({ options }: Props) {
  const [type, setType] = useState<ReportType>('company')
  const [employeeId, setEmployeeId] = useState('')
  const [department, setDepartment] = useState('')
  const [from, setFrom] = useState('2026-07-01')
  const [to, setTo] = useState(yesterday())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const ready = type === 'company' || (type === 'employee' && employeeId) || (type === 'department' && department)

  const handleDownload = () => {
    setError(null)
    if (!from || !to) { setError('Выберите период'); return }
    const params = new URLSearchParams({ type, from, to })
    if (type === 'employee') params.set('id', employeeId)
    if (type === 'department') params.set('id', department)

    startTransition(async () => {
      try {
        const res = await fetch(`/admin/adoption/export?${params.toString()}`)
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? 'Не удалось сформировать отчёт')
        }
        const blob = await res.blob()
        const cd = res.headers.get('Content-Disposition') ?? ''
        const m = cd.match(/filename\*=UTF-8''([^;]+)/)
        const filename = m ? decodeURIComponent(m[1]) : 'отчёт.xlsx'
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка выгрузки')
      }
    })
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>Выгрузка отчёта в Excel</h3>
        <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>один файл, листы по разделам</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {TYPE_LABELS.map((t) => (
            <TypeChip key={t.value} active={type === t.value} onClick={() => { setType(t.value); setError(null) }}>{t.label}</TypeChip>
          ))}
        </div>

        {type === 'employee' && <EmployeeSelect options={options.employees} value={employeeId} onChange={setEmployeeId} />}
        {type === 'department' && (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-[12px] outline-none w-[280px]"
            style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)', color: 'var(--apex-text)' }}
          >
            <option value="">Выберите отдел…</option>
            {options.departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        <DateRangePicker from={from} to={to} months={2} onChange={(f, t) => { setFrom(f); setTo(t) }} />

        <button
          onClick={handleDownload}
          disabled={!ready || isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-50"
          style={{ background: 'var(--apex-primary)', color: '#fff' }}
        >
          <Download size={14} />
          {isPending ? 'Формирую…' : 'Скачать .xlsx'}
        </button>
      </div>

      {error && <p className="text-[11px]" style={{ color: 'var(--apex-danger)' }}>{error}</p>}
    </div>
  )
}
