'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DayOffInstructions } from './DayOffInstructions'
import { DayOffForm } from './DayOffForm'
import { DayOffRequestList } from './DayOffRequestList'
import { DayOffStatusPoller } from './DayOffStatusPoller'
import type { DayOffRequest } from '../types'

interface DayOffContentProps {
  initialRequests: DayOffRequest[]
  bookedDates: Record<string, string>
}

export function DayOffContent({ initialRequests, bookedDates }: DayOffContentProps) {
  const router = useRouter()
  const [requests, setRequests] = useState<DayOffRequest[]>(initialRequests)

  const hasActiveRequest = requests.some(r => r.status === 'pending')

  function handleSubmitSuccess(ids: string[], requestedDates: string[], note: string | null) {
    const now = new Date().toISOString()
    const optimisticEntries: DayOffRequest[] = ids.map((id, i) => ({
      id,
      ws_user_id:       '',
      user_name:        '',
      requested_date:   requestedDates[i],
      note,
      screenshot_url:   null,
      status:           'pending',
      rejection_reason: null,
      reviewed_at:      null,
      resolved_at:      null,
      created_at:       now,
    }))
    setRequests(prev => [...optimisticEntries, ...prev])
    router.refresh()
  }

  return (
    <>
      <div className="animate-fade-in-up stagger-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DayOffInstructions />
        <DayOffForm
          bookedDates={bookedDates}
          onSubmitSuccess={handleSubmitSuccess}
        />
      </div>

      <div className="animate-fade-in-up stagger-2">
        <DayOffRequestList requests={requests} />
      </div>

      <DayOffStatusPoller hasActiveRequest={hasActiveRequest} />
    </>
  )
}
