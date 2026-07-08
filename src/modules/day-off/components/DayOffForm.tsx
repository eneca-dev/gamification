'use client'

import { useState, useTransition, useRef } from 'react'
import { AlertTriangle, Upload, X, Loader2 } from 'lucide-react'
import { submitBatchDayOffRequests, uploadDayOffScreenshot } from '@/modules/day-off/index.client'
import { DatePicker } from '@/components/DatePicker'
import { DAY_OFF_CUTOFF_LABEL, getMinDayOffDate, isSameDayCutoffPassed } from '../utils'
import type { DayOffRequestType } from '../types'

interface DayOffFormProps {
  bookedDates: Record<string, string>
  requestType: DayOffRequestType
  onRequestTypeChange: (type: DayOffRequestType) => void
  onSubmitSuccess?: (ids: string[], requestedDates: string[], note: string | null, requestType: DayOffRequestType) => void
}

export function DayOffForm({ bookedDates, requestType, onRequestTypeChange, onSubmitSuccess }: DayOffFormProps) {
  const [isPending, startTransition] = useTransition()
  const [dates, setDates] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null)
  const [screenshotName, setScreenshotName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const minDateStr = getMinDayOffDate()
  const cutoffPassed = isSameDayCutoffPassed()

  const isBusinessTrip = requestType === 'business_trip'

  function handleTypeChange(type: DayOffRequestType) {
    onRequestTypeChange(type)
    setScreenshotPath(null)
    setScreenshotName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setError(null)
  }

  async function uploadFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadDayOffScreenshot(fd)
      if (!result.success) { setError(result.error); return }
      setScreenshotPath(result.path)
      setScreenshotName(file.name)
    } finally {
      setUploading(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
  }

  async function handlePaste(e: React.ClipboardEvent) {
    if (screenshotPath || isBusinessTrip) return
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))
    if (!item) return
    const file = item.getAsFile()
    if (!file) return
    const named = new File([file], `screenshot_${Date.now()}.png`, { type: file.type })
    await uploadFile(named)
  }

  function handleRemoveFile() {
    setScreenshotPath(null)
    setScreenshotName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isBusinessTrip && !screenshotPath) { setError('Прикрепите скриншот согласования'); return }
    setError(null)

    startTransition(async () => {
      const result = await submitBatchDayOffRequests({
        requested_dates: dates,
        request_type:    requestType,
        note:            note.trim() || undefined,
        screenshot_url:  screenshotPath,
      })
      if (!result.success) { setError(result.error); return }
      const submittedDates = dates
      const submittedNote = note.trim() || null
      setDates([])
      setNote('')
      setScreenshotPath(null)
      setScreenshotName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onSubmitSuccess?.(result.ids, submittedDates, submittedNote, requestType)
    })
  }

  const isDisabled = isPending || dates.length === 0 || uploading || (!isBusinessTrip && !screenshotPath)
  const labelClass = 'block text-[12px] font-semibold mb-1.5'
  const inputStyle = {
    background: 'var(--apex-bg)',
    border: '1px solid var(--apex-border)',
    color: 'var(--apex-text)',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
  }

  return (
    <form
      onSubmit={handleSubmit}
      onPaste={handlePaste}
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <h3 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
        Новая заявка
      </h3>

      {/* Переключатель типа */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
        data-onboarding="day-off-type-switch"
      >
        {(['day_off', 'business_trip'] as DayOffRequestType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
            style={{
              background: requestType === type ? 'var(--apex-surface)' : 'transparent',
              color: requestType === type ? 'var(--apex-text)' : 'var(--apex-text-muted)',
              boxShadow: requestType === type ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {type === 'day_off' ? 'Соцотпуск' : 'Командировка'}
          </button>
        ))}
      </div>

      <div>
        <label className={labelClass} style={{ color: 'var(--apex-text-secondary)' }}>
          {isBusinessTrip ? 'Дата командировки' : 'Дата выходного'}
        </label>
        <DatePicker
          values={dates}
          onChangeMulti={setDates}
          minDate={minDateStr}
          disabledDates={bookedDates}
          placeholder="Выберите даты"
        />
        {cutoffPassed ? (
          <div
            className="flex items-start gap-2 p-2.5 rounded-xl mt-2"
            style={{ background: 'var(--apex-warning-bg)', border: '1px solid var(--apex-warning-border)' }}
          >
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--apex-warning-text)' }} />
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--apex-warning-dark)' }}>
              На сегодня заявку оформить уже нельзя — приём заявок на сегодня закончился в {DAY_OFF_CUTOFF_LABEL}.
              Ближайшая доступная дата — завтра.
            </p>
          </div>
        ) : (
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--apex-text-muted)' }}>
            Заявку на сегодня можно подать до {DAY_OFF_CUTOFF_LABEL} — позже HR не успеет её рассмотреть.
          </p>
        )}
      </div>

      <div>
        <label className={labelClass} style={{ color: 'var(--apex-text-secondary)' }}>
          Комментарий <span style={{ color: 'var(--apex-text-muted)' }}>(необязательно)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Причина или пояснение..."
          style={{ ...inputStyle, resize: 'none' }}
        />
      </div>

      {!isBusinessTrip && (
        <div>
          <label className={labelClass} style={{ color: 'var(--apex-text-secondary)' }}>
            Скриншот согласования с руководителем
            <span className="ml-1" style={{ color: 'var(--apex-danger)' }}>*</span>
          </label>

          {screenshotPath ? (
            <div
              className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--apex-success-bg)', border: '1px solid var(--apex-border)' }}
            >
              <span className="text-[12px] font-medium truncate" style={{ color: 'var(--apex-primary)' }}>
                {screenshotName}
              </span>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="flex-shrink-0 p-1 rounded-full hover:bg-black/5"
                style={{ color: 'var(--apex-text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer.files?.[0]
                if (file) uploadFile(file)
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-medium transition-colors"
              style={{
                background: isDragging ? 'var(--apex-primary-bg)' : 'var(--apex-bg)',
                border: `2px dashed ${isDragging ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
                color: uploading ? 'var(--apex-text-muted)' : isDragging ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
                cursor: uploading ? 'default' : 'pointer',
              }}
            >
              {uploading ? (
                <><Loader2 size={15} className="animate-spin" /> Загружается...</>
              ) : (
                <><Upload size={15} /> Выбрать файл, перетащить или Ctrl+V</>
              )}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {error && (
        <p className="text-[12px] font-medium" style={{ color: 'var(--apex-danger)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isDisabled}
        data-onboarding="day-off-submit"
        className="w-full py-2.5 rounded-xl text-[13px] font-bold transition-all"
        style={{
          background: isDisabled ? 'var(--apex-disabled-bg)' : 'var(--apex-primary)',
          color: isDisabled ? 'var(--apex-text-muted)' : 'white',
          cursor: isDisabled ? 'default' : 'pointer',
        }}
      >
        {isPending ? 'Отправляем...' : 'Отправить заявку'}
      </button>
    </form>
  )
}
