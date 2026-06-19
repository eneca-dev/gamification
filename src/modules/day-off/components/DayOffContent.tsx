'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DayOffInstructions } from './DayOffInstructions'
import { DayOffForm } from './DayOffForm'
import { DayOffRequestList } from './DayOffRequestList'
import { DayOffStatusPoller } from './DayOffStatusPoller'
import type { DayOffRequest, DayOffRequestType } from '../types'

interface DayOffContentProps {
  initialRequests: DayOffRequest[]
  bookedDates: Record<string, string>
}

export function DayOffContent({ initialRequests, bookedDates }: DayOffContentProps) {
  const router = useRouter()
  const [requests, setRequests] = useState<DayOffRequest[]>(initialRequests)
  const [requestType, setRequestType] = useState<DayOffRequestType>('day_off')

  const hasActiveRequest = requests.some(r => r.status === 'pending')

  function handleSubmitSuccess(ids: string[], requestedDates: string[], note: string | null, type: DayOffRequestType) {
    const now = new Date().toISOString()
    const optimisticEntries: DayOffRequest[] = ids.map((id, i) => ({
      id,
      ws_user_id:       '',
      user_name:        '',
      requested_date:   requestedDates[i],
      request_type:     type,
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
      <div className="animate-fade-in-up stagger-1 grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
        <DayOffInstructions requestType={requestType} />
        <DayOffForm
          bookedDates={bookedDates}
          requestType={requestType}
          onRequestTypeChange={setRequestType}
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
