'use client'

import { useState, useTransition, useRef } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { submitBatchDayOffRequests, uploadDayOffScreenshot } from '@/modules/day-off/index.client'
import { DatePicker } from '@/components/DatePicker'

interface DayOffFormProps {
  bookedDates: Record<string, string>
  onSubmitSuccess?: (ids: string[], requestedDates: string[], note: string | null) => void
}

export function DayOffForm({ bookedDates, onSubmitSuccess }: DayOffFormProps) {
  const [isPending, startTransition] = useTransition()
  const [dates, setDates] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null)
  const [screenshotName, setScreenshotName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
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

  function handleRemoveFile() {
    setScreenshotPath(null)
    setScreenshotName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!screenshotPath) { setError('Прикрепите скриншот согласования'); return }
    setError(null)

    startTransition(async () => {
      const result = await submitBatchDayOffRequests({
        requested_dates: dates,
        note: note.trim() || undefined,
        screenshot_url: screenshotPath,
      })
      if (!result.success) { setError(result.error); return }
      const submittedDates = dates
      const submittedNote = note.trim() || null
      setDates([])
      setNote('')
      setScreenshotPath(null)
      setScreenshotName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onSubmitSuccess?.(result.ids, submittedDates, submittedNote)
    })
  }

  const isDisabled = isPending || dates.length === 0 || uploading || !screenshotPath
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
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <h3 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
        Новая заявка
      </h3>

      <div>
        <label className={labelClass} style={{ color: 'var(--apex-text-secondary)' }}>
          Дата выходного
        </label>
        <DatePicker
          values={dates}
          onChangeMulti={setDates}
          minDate={minDateStr}
          disabledDates={bookedDates}
          placeholder="Выберите даты"
        />
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
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-medium transition-colors"
            style={{
              background: 'var(--apex-bg)',
              border: '2px dashed var(--apex-border)',
              color: uploading ? 'var(--apex-text-muted)' : 'var(--apex-text-secondary)',
              cursor: uploading ? 'default' : 'pointer',
            }}
          >
            {uploading ? (
              <><Loader2 size={15} className="animate-spin" /> Загружается...</>
            ) : (
              <><Upload size={15} /> Выбрать файл (JPG, PNG, до 5 МБ)</>
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

      {error && (
        <p className="text-[12px] font-medium" style={{ color: 'var(--apex-danger)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isDisabled}
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
