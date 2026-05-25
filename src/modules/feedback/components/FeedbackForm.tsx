'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { X, Paperclip, Bug, Lightbulb, CheckCircle2, ClipboardPaste } from 'lucide-react'

import { submitFeedback, uploadFeedbackImages } from '@/modules/feedback/index.client'
import type { FeedbackType } from '@/modules/feedback/index.client'

interface ImagePreview {
  file: File
  previewUrl: string
}

const MAX_FILES = 5
const MAX_FILE_SIZE_MB = 10

export function FeedbackForm() {
  const [type, setType] = useState<FeedbackType>('bug')
  const [typeSelected, setTypeSelected] = useState(false)
  const [header, setHeader] = useState('')
  const [description, setDescription] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pasteHint, setPasteHint] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function handleTypeChange(newType: FeedbackType) {
    setType(newType)
  }

  function resetForm(newType: FeedbackType) {
    setType(newType)
    setTypeSelected(true)
    setHeader('')
    setDescription('')
    setExpectedBehavior('')
    images.forEach((i) => URL.revokeObjectURL(i.previewUrl))
    setImages([])
    setError(null)
    setPasteHint(false)
    setLightboxUrl(null)
    setSuccess(false)
  }

  const addFiles = useCallback((files: File[]) => {
    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024)
    if (oversized.length > 0) {
      setError(`Файл ${oversized[0].name} превышает ${MAX_FILE_SIZE_MB} МБ`)
      return
    }
    setImages((prev) => {
      const remaining = MAX_FILES - prev.length
      const toAdd = files.slice(0, remaining).map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }))
      return [...prev, ...toAdd]
    })
  }, [])

  function handleFilesAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    addFiles(selected)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  // Вставка из буфера обмена — глобальный обработчик
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageFiles = items
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null)

      if (imageFiles.length === 0) return
      e.preventDefault()
      addFiles(imageFiles)
      setPasteHint(true)
      setTimeout(() => setPasteHint(false), 2000)
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [addFiles])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!header.trim()) {
      setError('Укажите заголовок')
      return
    }
    if (!description.trim()) {
      setError('Опишите, что происходит')
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
          description: description.trim(),
          expected_behavior: type === 'bug' ? (expectedBehavior.trim() || undefined) : undefined,
          image_urls: imageUrls,
        })

        if (!result.success) {
          setError(result.error)
          return
        }

        images.forEach((i) => URL.revokeObjectURL(i.previewUrl))
        setSuccess(true)
      } catch {
        setError('Не удалось отправить. Проверьте соединение и попробуйте снова')
      }
    })
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <CheckCircle2 size={52} style={{ color: 'var(--apex-primary)' }} />
        <p className="text-lg font-semibold" style={{ color: 'var(--apex-text)' }}>
          Спасибо! Мы получили ваш отзыв
        </p>
        <p className="text-sm" style={{ color: 'var(--apex-text-secondary)' }}>
          Можете закрыть эту вкладку
        </p>
        <div className="flex flex-col items-center gap-2 mt-2 w-full">
          <p className="text-xs" style={{ color: 'var(--apex-text-muted)' }}>Отправить ещё:</p>
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={() => resetForm('bug')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium border transition-colors"
              style={{ background: 'transparent', color: 'var(--apex-text-secondary)', borderColor: 'var(--apex-border)' }}
            >
              <Bug size={15} />
              Баг
            </button>
            <button
              type="button"
              onClick={() => resetForm('suggestion')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium border transition-colors"
              style={{ background: 'transparent', color: 'var(--apex-text-secondary)', borderColor: 'var(--apex-border)' }}
            >
              <Lightbulb size={15} />
              Предложение
            </button>
          </div>
        </div>
      </div>
    )
  }

  const headerPlaceholder = type === 'bug'
    ? 'Например: «Некорректные штрафы», «Ошибка в благодарностях»'
    : 'Например: «Благодарности», «Оформление профиля»'

  if (!typeSelected) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
          Что хотите сообщить?
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => { setType('bug'); setTypeSelected(true) }}
            className="flex items-center gap-4 w-full rounded-xl px-5 py-4 border text-left transition-colors"
            style={{ background: 'var(--apex-bg)', borderColor: 'var(--apex-border)' }}
          >
            <Bug size={22} style={{ color: 'var(--apex-danger)', flexShrink: 0 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--apex-text)' }}>Баг / ошибка</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--apex-text-secondary)' }}>
                Что-то работает не так, как должно
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setType('suggestion'); setTypeSelected(true) }}
            className="flex items-center gap-4 w-full rounded-xl px-5 py-4 border text-left transition-colors"
            style={{ background: 'var(--apex-bg)', borderColor: 'var(--apex-border)' }}
          >
            <Lightbulb size={22} style={{ color: 'var(--apex-primary)', flexShrink: 0 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--apex-text)' }}>Предложение</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--apex-text-secondary)' }}>
                Идея или улучшение для приложения
              </p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Type selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleTypeChange('bug')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium border transition-colors"
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
          Баг / ошибка
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('suggestion')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium border transition-colors"
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
        <div className="flex flex-col gap-0.5">
          <label className="text-xs font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
            {type === 'bug' ? 'В чем проблема? Опишите в двух словах' : 'К чему относится? Опишите в двух словах'}{' '}
            <span style={{ color: 'var(--apex-danger)' }}>*</span>
          </label>
          <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
            {headerPlaceholder}
          </p>
        </div>
        <input
          type="text"
          value={header}
          onChange={(e) => setHeader(e.target.value)}
          placeholder={type === 'bug' ? 'Проблема с...' : 'Модуль...'}
          className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none transition-colors"
          style={{
            background: 'var(--apex-bg)',
            borderColor: 'var(--apex-border)',
            color: 'var(--apex-text)',
          }}
          maxLength={200}
        />
      </div>

      {/* Description — required */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
          {type === 'bug' ? 'Что именно идет не так? Опишите подробно' : 'Подробности'}{' '}
          <span style={{ color: 'var(--apex-danger)' }}>*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onInput={(e) => autoResize(e.currentTarget)}
          placeholder={type === 'bug'
            ? 'Что пошло не так, шаги для воспроизведения, что происходит на экране'
            : 'Опишите идею подробнее: зачем это нужно и как должно работать'}
          className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none resize-none overflow-hidden transition-colors"
          style={{
            background: 'var(--apex-bg)',
            borderColor: 'var(--apex-border)',
            color: 'var(--apex-text)',
            minHeight: '6rem',
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
            ref={(el) => { if (el) autoResize(el) }}
            onChange={(e) => setExpectedBehavior(e.target.value)}
            onInput={(e) => autoResize(e.currentTarget)}
            placeholder="Ожидаемое поведение"
            className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none resize-none overflow-hidden transition-colors"
            style={{
              background: 'var(--apex-bg)',
              borderColor: 'var(--apex-border)',
              color: 'var(--apex-text)',
              minHeight: '4rem',
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
                  className="w-20 h-20 object-cover rounded-lg border cursor-zoom-in"
                  style={{ borderColor: 'var(--apex-border)' }}
                  onClick={() => setLightboxUrl(img.previewUrl)}
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'var(--apex-danger)', color: '#fff' }}
                >
                  <X size={11} />
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
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-sm rounded-lg px-3 py-2.5 border border-dashed transition-colors w-full"
                style={{
                  borderColor: 'var(--apex-border)',
                  color: 'var(--apex-text-secondary)',
                  background: 'var(--apex-bg)',
                }}
              >
                <Paperclip size={14} />
                Прикрепить файл
              </button>
              <p
                className="text-xs flex items-center gap-1.5 transition-colors"
                style={{ color: pasteHint ? 'var(--apex-primary)' : 'var(--apex-text-muted)' }}
              >
                <ClipboardPaste size={12} />
                {pasteHint ? 'Скриншот вставлен!' : 'Или вставьте скриншот из буфера — Ctrl+V / ⌘+V'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-error-text)' }}>
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || !header.trim() || !description.trim()}
        className="w-full py-3 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: isPending || !header.trim() || !description.trim()
            ? 'var(--apex-disabled-bg)'
            : 'var(--apex-primary)',
          color: isPending || !header.trim() || !description.trim()
            ? 'var(--apex-disabled-text)'
            : '#fff',
        }}
      >
        {isPending ? 'Отправка...' : 'Отправить'}
      </button>
    </form>

    {lightboxUrl && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)' }}
        onClick={() => setLightboxUrl(null)}
      >
        <button
          type="button"
          onClick={() => setLightboxUrl(null)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
        >
          <X size={18} />
        </button>
        <img
          src={lightboxUrl}
          alt=""
          className="max-w-full max-h-full rounded-xl object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    </>
  )
}
