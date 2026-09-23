'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { DateRangePicker } from '@/components/DateRangePicker'

export function AdoptionDateFilter({ from, to }: { from: string | null; to: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const changeRange = (nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextFrom && nextTo) {
      params.set('from', nextFrom)
      params.set('to', nextTo)
    } else {
      params.delete('from')
      params.delete('to')
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  return (
    <div className={`rounded-2xl p-4 flex flex-col items-start gap-3 transition-opacity ${isPending ? 'opacity-70' : ''}`} style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold" style={{ color: 'var(--apex-text)' }}>Период отчёта</div>
        <div className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>Все показатели до блока «Итоги месяца» пересчитываются по этому диапазону</div>
      </div>
      <div className="w-full sm:w-auto"><DateRangePicker from={from ?? ''} to={from ? to : ''} months={2} emptyLabel="За всё время" onChange={changeRange} /></div>
    </div>
  )
}
