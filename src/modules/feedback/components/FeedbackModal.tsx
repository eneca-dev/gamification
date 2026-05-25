'use client'

import { useState, useTransition, useRef } from 'react'
import { X, Paperclip, Bug, Lightbulb, CheckCircle2 } from 'lucide-react'

import { submitFeedback, uploadFeedbackImages } from '@/modules/feedback/index.client'
import type { FeedbackType } from '@/modules/feedback/index.client'

interface FeedbackModalProps {
  onClose: () => void
}

interface ImagePreview {
  file: File
  previewUrl: string
}

const MAX_FILES = 5
const MAX_FILE_SIZE_MB = 10

export function FeedbackModal({ onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [header, setHeader] = useState('')
  const [description, setDescription] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleTypeChange(newType: FeedbackType) {
    setType(newType)
    setExpectedBehavior('')
  }

  function handleFilesAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return

    const oversized = selected.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024)
    if (oversized.length > 0) {
      setError(`Файл ${oversized[0].name} превышает ${MAX_FILE_SIZE_MB} МБ`)
      return
    }

    const remaining = MAX_FILES - images.length
    const toAdd = selected.slice(0, remaining).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setImages((prev) => [...prev, ...toAdd])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!header.trim()) {
      setError('Укажите заголовок')
      return
    }
    setError(null)

    startTransition(async () => {
      try {
        let imageUrls: string[] = []
        if (images.length > 0) {
          imageUrls = await uploadFeedbackImages(images.map((i) => i.file))
        }

        const result = await submitFeedback({
          type,
          header: header.trim(),
          description: description.trim() || undefined,
          expected_behavior: type === 'bug' ? (expectedBehavior.trim() || undefined) : undefined,
          image_urls: imageUrls,
        })

        if (!result.success) {
          setError(result.error)
          return
        }

        images.forEach((i) => URL.revokeObjectURL(i.previewUrl))
        setSuccess(true)
        setTimeout(onClose, 2000)
      } catch {
        setError('Не удалось отправить. Проверьте соединение и попробуйте снова')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
        style={{ background: 'var(--apex-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--apex-border)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--apex-text)' }}>
            Обратная связь
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
            style={{ color: 'var(--apex-text-secondary)' }}
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12">
            <CheckCircle2 size={48} style={{ color: 'var(--apex-primary)' }} />
            <p className="text-base font-medium" style={{ color: 'var(--apex-text)' }}>
              Спасибо! Мы получили ваш отзыв
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
            {/* Type selector */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('bug')}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium border transition-colors"
                style={type === 'bug' ? {
                  background: 'var(--apex-primary)',
                  color: '#fff',
                  borderColor: 'var(--apex-primary)',
                } : {
                  background: 'transparent',
                  color: 'var(--apex-text-secondary)',
                  borderColor: 'var(--apex-border)',
                }}
              >
                <Bug size={15} />
                Баг
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('suggestion')}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium border transition-colors"
                style={type === 'suggestion' ? {
                  background: 'var(--apex-primary)',
                  color: '#fff',
                  borderColor: 'var(--apex-primary)',
                } : {
                  background: 'transparent',
                  color: 'var(--apex-text-secondary)',
                  borderColor: 'var(--apex-border)',
                }}
              >
                <Lightbulb size={15} />
                Предложение
              </button>
            </div>

            {/* Header */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
                {type === 'bug' ? 'Что сломалось?' : 'Ваше предложение'}{' '}
                <span style={{ color: 'var(--apex-danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                placeholder={type === 'bug' ? 'Кратко опишите проблему' : 'Кратко опишите идею'}
                className="w-full rounded-lg px-3 py-2 text-sm border outline-none transition-colors"
                style={{
                  background: 'var(--apex-surface)',
                  borderColor: 'var(--apex-border)',
                  color: 'var(--apex-text)',
                }}
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
                {type === 'bug' ? 'Что происходит?' : 'Подробности'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={type === 'bug' ? 'Шаги для воспроизведения, что видите' : 'Опишите подробнее'}
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none transition-colors"
                style={{
                  background: 'var(--apex-surface)',
                  borderColor: 'var(--apex-border)',
                  color: 'var(--apex-text)',
                }}
              />
            </div>

            {/* Expected behavior (only for bugs) */}
            {type === 'bug' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
                  Что должно было произойти?
                </label>
                <textarea
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  placeholder="Ожидаемое поведение"
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none transition-colors"
                  style={{
                    background: 'var(--apex-surface)',
                    borderColor: 'var(--apex-border)',
                    color: 'var(--apex-text)',
                  }}
                />
              </div>
            )}

            {/* Image upload */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
                  Скриншоты
                </label>
                {images.length > 0 && (
                  <span className="text-xs" style={{ color: 'var(--apex-text-muted)' }}>
                    {images.length}/{MAX_FILES}
                  </span>
                )}
              </div>

              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={img.previewUrl}
                        alt={img.file.name}
                        className="w-16 h-16 object-cover rounded-lg border"
                        style={{ borderColor: 'var(--apex-border)' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'var(--apex-danger)', color: '#fff' }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < MAX_FILES && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFilesAdd}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 border border-dashed transition-colors"
                    style={{
                      borderColor: 'var(--apex-border)',
                      color: 'var(--apex-text-secondary)',
                    }}
                  >
                    <Paperclip size={14} />
                    Прикрепить скриншоты
                  </button>
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-error-text)' }}>
                {error}
              </p>
            )}

            {/* Footer */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-50"
                style={{
                  borderColor: 'var(--apex-border)',
                  color: 'var(--apex-text)',
                  background: 'var(--apex-surface)',
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isPending || !header.trim()}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isPending || !header.trim() ? 'var(--apex-disabled-bg)' : 'var(--apex-primary)',
                  color: isPending || !header.trim() ? 'var(--apex-disabled-text)' : '#fff',
                }}
              >
                {isPending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
