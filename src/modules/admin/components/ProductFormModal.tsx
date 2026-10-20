'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Upload, Trash2, Loader2, ChevronDown, Check, MessageSquare, ArrowUp, ArrowDown, Youtube, Play } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'
import {
  computePriceCrystals,
  computePriceWithoutDiscount,
  parseYouTubeId,
  youTubePoster,
  captureVideoPoster,
  MAX_PRODUCT_PHOTOS,
  MAX_PRODUCT_VIDEOS,
} from '@/modules/shop/index.client'
import type { ShopProductWithCategory, ShopCategory } from '@/modules/shop/index.client'

import type { ProductFormData, MediaDraftItem } from '../types'

const MAX_VIDEO_SIZE = 20 * 1024 * 1024
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']

function countPhotos(media: MediaDraftItem[]) {
  return media.filter((m) => m.kind === 'image').length
}
function countVideos(media: MediaDraftItem[]) {
  return media.filter((m) => m.kind === 'youtube' || m.kind === 'video').length
}

interface ProductFormModalProps {
  product: ShopProductWithCategory | null
  categories: ShopCategory[]
  rate: number
  onSave: (
    data: ProductFormData,
    mediaDraft: MediaDraftItem[],
    setProgress: (index: number, percent: number) => void,
  ) => void
  onClose: () => void
  isPending: boolean
}

export function ProductFormModal({ product, categories, rate, onSave, onClose, isPending }: ProductFormModalProps) {
  const isEditing = !!product
  const activeCategories = categories.filter((c) => c.is_active || c.id === product?.category_id)
  const defaultCategoryId = product?.category_id ?? activeCategories[0]?.id ?? ''

  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [costByn, setCostByn] = useState<string>(product ? String(product.cost_byn) : '')
  const [coefficient, setCoefficient] = useState<string>(product ? String(product.coefficient) : '1')
  const [categoryId, setCategoryId] = useState(defaultCategoryId)
  const [emoji, setEmoji] = useState(product?.emoji ?? '')
  const [stock, setStock] = useState<string>(product?.stock != null ? String(product.stock) : '')
  const [userDiscountPercent, setUserDiscountPercent] = useState<string>(
    product?.discount_percent != null ? String(product.discount_percent) : ''
  )
  const [media, setMedia] = useState<MediaDraftItem[]>(() =>
    (product?.media ?? []).map((item): MediaDraftItem => {
      if (item.kind === 'image') return { kind: 'image', source: 'existing', url: item.url }
      if (item.kind === 'youtube') return { kind: 'youtube', video_id: item.video_id }
      return { kind: 'video', source: 'existing', url: item.url, poster_url: item.poster_url }
    }),
  )
  const mediaRef = useRef(media)
  const mountedRef = useRef(true)
  const saveStartedRef = useRef(false)
  function commitMedia(next: MediaDraftItem[]) {
    mediaRef.current = next
    setMedia(next)
  }
  const [youtubeInput, setYoutubeInput] = useState('')
  const [commentRequired, setCommentRequired] = useState(product?.comment_required ?? false)
  const [commentLabel, setCommentLabel] = useState(product?.comment_label ?? '')
  const [commentPlaceholder, setCommentPlaceholder] = useState(product?.comment_placeholder ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedCategory = categories.find((c) => c.id === categoryId)
  const isCountable = selectedCategory?.is_countable ?? false

  useEffect(() => {
    if (!isPending) saveStartedRef.current = false
  }, [isPending])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    document.addEventListener('keydown', handleEsc)

    // Блокируем скролл body при открытии модалки
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, isPending])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      for (const item of mediaRef.current) {
        if (item.kind === 'image' && item.source === 'new') URL.revokeObjectURL(item.previewUrl)
        if (item.kind === 'video' && item.source === 'new') {
          URL.revokeObjectURL(item.previewUrl)
          if (item.posterPreviewUrl) URL.revokeObjectURL(item.posterPreviewUrl)
        }
      }
    }
  }, [])

  async function processFile(file: File) {
    if (isPending) return
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')

    if (isVideo) {
      if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
        setErrors((prev) => ({ ...prev, media: 'Формат видео: MP4 или WebM' }))
        return
      }
      if (file.size > MAX_VIDEO_SIZE) {
        setErrors((prev) => ({ ...prev, media: 'Максимум 20 МБ (используйте 720p ~1 мин)' }))
        return
      }
      if (countVideos(mediaRef.current) >= MAX_PRODUCT_VIDEOS) {
        setErrors((prev) => ({ ...prev, media: `Максимум ${MAX_PRODUCT_VIDEOS} видео на товар` }))
        return
      }
      const previewUrl = URL.createObjectURL(file)
      commitMedia([...mediaRef.current, { kind: 'video', source: 'new', file, posterBlob: null, previewUrl, posterPreviewUrl: null, progress: 0 }])
      const posterBlob = await captureVideoPoster(file)
      if (mountedRef.current && posterBlob && mediaRef.current.some((item) => item.kind === 'video' && item.source === 'new' && item.previewUrl === previewUrl)) {
        commitMedia(mediaRef.current.map((item) =>
          item.kind === 'video' && item.source === 'new' && item.previewUrl === previewUrl
            ? { ...item, posterBlob, posterPreviewUrl: URL.createObjectURL(posterBlob) }
            : item,
        ))
      }
      if (!mountedRef.current) return
      setErrors((prev) => {
        const next = { ...prev }
        delete next.media
        return next
      })
      return
    }

    if (!isImage) {
      setErrors((prev) => ({ ...prev, media: 'Поддерживаются JPEG/PNG/WebP и MP4/WebM' }))
      return
    }

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedImageTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, media: 'Формат фото: JPEG, PNG или WebP' }))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, media: 'Фото максимум 2 МБ' }))
      return
    }

    if (countPhotos(mediaRef.current) >= MAX_PRODUCT_PHOTOS) {
      setErrors((prev) => ({ ...prev, media: `Максимум ${MAX_PRODUCT_PHOTOS} фото на товар` }))
      return
    }
    commitMedia([...mediaRef.current, { kind: 'image', source: 'new', file, previewUrl: URL.createObjectURL(file) }])
    setErrors((prev) => {
      const next = { ...prev }
      delete next.media
      return next
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) await processFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    for (const file of files) await processFile(file)
  }

  function removeMediaAt(idx: number) {
    const list = mediaRef.current
    const item = list[idx]
    if (item?.kind === 'image' && item.source === 'new') {
      URL.revokeObjectURL(item.previewUrl)
    }
    if (item?.kind === 'video' && item.source === 'new') {
      URL.revokeObjectURL(item.previewUrl)
      if (item.posterPreviewUrl) URL.revokeObjectURL(item.posterPreviewUrl)
    }
    commitMedia(list.filter((_, i) => i !== idx))
  }

  function moveMedia(idx: number, delta: number) {
    const target = idx + delta
    if (target < 0 || target >= mediaRef.current.length) return
    const next = mediaRef.current.slice()
    ;[next[idx], next[target]] = [next[target], next[idx]]
    commitMedia(next)
  }

  function addYouTube() {
    if (isPending) return
    const videoId = parseYouTubeId(youtubeInput)
    if (!videoId) {
      setErrors((prev) => ({ ...prev, media: 'Это не ссылка на YouTube' }))
      return
    }
    if (countVideos(mediaRef.current) >= MAX_PRODUCT_VIDEOS) {
      setErrors((prev) => ({ ...prev, media: `Максимум ${MAX_PRODUCT_VIDEOS} видео на товар` }))
      return
    }
    if (mediaRef.current.some((m) => m.kind === 'youtube' && m.video_id === videoId)) {
      setErrors((prev) => ({ ...prev, media: 'Это видео уже добавлено' }))
      return
    }
    commitMedia([...mediaRef.current, { kind: 'youtube', video_id: videoId }])
    setYoutubeInput('')
    setErrors((prev) => {
      const next = { ...prev }
      delete next.media
      return next
    })
  }

  function handleUserDiscountChange(val: string) {
    setUserDiscountPercent(val)
  }

  const costBynNum = parseFloat(costByn.replace(',', '.')) || 0
  const coefficientNum = parseFloat(coefficient.replace(',', '.')) || 0
  const userDiscountPercentNum = parseInt(userDiscountPercent, 10)
  const priceCrystals = costBynNum > 0 && coefficientNum > 0
    ? computePriceCrystals(costBynNum, coefficientNum, rate, product?.price_adjustment_crystals ?? 0)
    : 0
  const priceWithoutDiscountCrystals = priceCrystals > 0 && userDiscountPercent !== '' && !isNaN(userDiscountPercentNum) && userDiscountPercentNum > 0
    ? computePriceWithoutDiscount(priceCrystals, userDiscountPercentNum)
    : null
  const displayDiscount = !isNaN(userDiscountPercentNum) && userDiscountPercentNum > 0
    ? userDiscountPercentNum
    : null

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Название обязательно'
    if (costBynNum <= 0) errs.cost_byn = 'Себестоимость > 0'
    if (coefficientNum <= 0) errs.coefficient = 'Коэффициент > 0'
    if (!categoryId) errs.category_id = 'Выберите категорию'
    if (isCountable && stock === '') errs.stock = 'Укажите количество'
    if (isCountable && stock !== '') {
      const stockNum = parseInt(stock, 10)
      if (isNaN(stockNum) || stockNum < 0) errs.stock = 'Количество должно быть >= 0'
    }
    if (countPhotos(mediaRef.current) > MAX_PRODUCT_PHOTOS || countVideos(mediaRef.current) > MAX_PRODUCT_VIDEOS) {
      errs.media = 'Превышен лимит медиа'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending || saveStartedRef.current) return
    if (!validate()) return
    saveStartedRef.current = true

    const data: ProductFormData = {
      name: name.trim(),
      description: description.trim() || null,
      cost_byn: costBynNum,
      coefficient: coefficientNum,
      discount_percent: userDiscountPercent !== '' && !isNaN(userDiscountPercentNum) && userDiscountPercentNum > 0 ? userDiscountPercentNum : null,
      category_id: categoryId,
      emoji: emoji.trim() || null,
      stock: isCountable ? parseInt(stock, 10) : null,
      sort_order: product?.sort_order ?? 0,
      comment_required: commentRequired,
      comment_label: commentRequired && commentLabel.trim() ? commentLabel.trim() : null,
      comment_placeholder: commentRequired && commentPlaceholder.trim() ? commentPlaceholder.trim() : null,
    }

    onSave(data, mediaRef.current, (index, percent) => {
      commitMedia(mediaRef.current.map((m, i) =>
          i === index && m.kind === 'video' && m.source === 'new' ? { ...m, progress: percent } : m,
        ))
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => { if (!isPending) onClose() }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 animate-scale-in"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
        onClick={(e) => e.stopPropagation()}
        onPaste={(e) => {
          if (isPending) return
          for (const item of Array.from(e.clipboardData.items)) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile()
              if (file) { void processFile(file); break }
            }
          }
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 id="product-form-title" className="text-[16px] font-bold" style={{ color: 'var(--apex-text)' }}>
            {isEditing ? 'Редактировать товар' : 'Новый товар'}
          </h2>
          <button
            onClick={() => { if (!isPending) onClose() }}
            disabled={isPending}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <fieldset disabled={isPending} className="space-y-4">
          {/* Название */}
          <Field label="Название" error={errors.name}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
              style={inputStyle(errors.name)}
              placeholder="Название товара"
            />
          </Field>

          {/* Описание */}
          <Field label="Описание">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none"
              style={inputStyle()}
              rows={3}
              placeholder="Описание товара"
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            {/* Себестоимость в BYN */}
            <Field label="Себестоимость (BYN)" error={errors.cost_byn}>
              <input
                type="text"
                inputMode="decimal"
                value={costByn}
                onChange={(e) => setCostByn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                style={inputStyle(errors.cost_byn)}
                placeholder="0.00"
              />
            </Field>

            {/* Коэффициент */}
            <Field label="Коэффициент" error={errors.coefficient}>
              <input
                type="text"
                inputMode="decimal"
                value={coefficient}
                onChange={(e) => setCoefficient(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                style={inputStyle(errors.coefficient)}
                placeholder="1.0"
              />
            </Field>

            {/* Категория */}
            <Field label="Категория" error={errors.category_id}>
              <CustomSelect
                value={categoryId}
                onChange={setCategoryId}
                options={activeCategories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Выберите..."
                error={errors.category_id}
              />
            </Field>
          </div>

          {/* Скидка для покупателя */}
          <Field label="Скидка %">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={userDiscountPercent}
                onChange={(e) => handleUserDiscountChange(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                style={inputStyle()}
                min={1}
                max={99}
                placeholder="Нет скидки"
              />
              {userDiscountPercent !== '' && (
                <button
                  type="button"
                  onClick={() => setUserDiscountPercent('')}
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ color: 'var(--apex-text-muted)', background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </Field>

          {/* Превью цены для пользователя */}
          <div
            className="rounded-lg px-3 py-2 flex items-center justify-between"
            style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
          >
            <span className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
              Цена для пользователя при курсе {rate}
            </span>
            <div className="flex items-center gap-2">
              {priceWithoutDiscountCrystals !== null && (
                <>
                  <span className="relative opacity-50">
                    <CoinStatic amount={priceWithoutDiscountCrystals} size="sm" />
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ background: 'var(--apex-text-secondary)' }} />
                  </span>
                  <span
                    className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
                  >
                    −{displayDiscount}%
                  </span>
                </>
              )}
              <CoinStatic amount={priceCrystals} size="sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Эмодзи */}
            <Field label="Эмодзи">
              <EmojiInput value={emoji} onChange={setEmoji} />
            </Field>

            {/* Stock */}
            <Field
              label={isCountable ? 'Количество' : 'Количество (безлимит)'}
              error={errors.stock}
            >
              <input
                type="number"
                value={isCountable ? stock : ''}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                style={inputStyle(errors.stock)}
                min={0}
                disabled={!isCountable}
                placeholder={isCountable ? '0' : 'Безлимит'}
              />
            </Field>
          </div>

          {/* Медиа (фото + YouTube) */}
          <Field label={`Медиа · фото ${countPhotos(media)}/${MAX_PRODUCT_PHOTOS} · видео ${countVideos(media)}/${MAX_PRODUCT_VIDEOS}`} error={errors.media}>
            <div className="space-y-2">
              {media.length > 0 && (
                <div className="space-y-2">
                  {media.map((item, idx) => {
                    const isCover = idx === 0 && item.kind === 'image'
                    let previewSrc: string | null = null
                    let label = ''
                    let isVideoItem = false
                    if (item.kind === 'image') {
                      previewSrc = item.source === 'existing' ? item.url : item.previewUrl
                      label = item.source === 'existing' ? 'Фото' : `Фото · ${item.file.name}`
                    } else if (item.kind === 'youtube') {
                      previewSrc = youTubePoster(item.video_id)
                      label = `YouTube · ${item.video_id}`
                      isVideoItem = true
                    } else {
                      isVideoItem = true
                      if (item.source === 'existing') {
                        previewSrc = item.poster_url
                        label = 'Видео'
                      } else {
                         previewSrc = item.posterPreviewUrl
                        label = `Видео · ${item.file.name}`
                      }
                    }
                    const progress = item.kind === 'video' && item.source === 'new' ? item.progress : null
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-lg"
                        style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
                      >
                        <div className="relative w-16 h-12 rounded overflow-hidden shrink-0" style={{ background: '#000' }}>
                          {previewSrc && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={previewSrc} alt="" className="w-full h-full object-cover" />
                          )}
                          {isVideoItem && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play size={14} fill="white" color="white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium truncate" style={{ color: 'var(--apex-text)' }}>
                            {label}
                          </div>
                          {isCover && (
                            <div className="text-[10px]" style={{ color: 'var(--apex-primary)' }}>
                              Главное фото (обложка)
                            </div>
                          )}
                          {progress !== null && progress > 0 && progress < 100 && (
                            <div className="mt-1 h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--apex-border)' }}>
                              <div
                                className="h-full transition-all"
                                style={{ width: `${progress}%`, background: 'var(--apex-primary)' }}
                              />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => moveMedia(idx, -1)}
                          disabled={idx === 0}
                          className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-30"
                          style={{ color: 'var(--apex-text-muted)' }}
                          aria-label="Вверх"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMedia(idx, 1)}
                          disabled={idx === media.length - 1}
                          className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-30"
                          style={{ color: 'var(--apex-text-muted)' }}
                          aria-label="Вниз"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMediaAt(idx)}
                          className="w-7 h-7 rounded flex items-center justify-center"
                          style={{ background: 'var(--apex-danger)', color: 'white' }}
                          aria-label="Удалить"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {(() => {
                const photoFull = countPhotos(media) >= MAX_PRODUCT_PHOTOS
                const videoFull = countVideos(media) >= MAX_PRODUCT_VIDEOS
                const dropzoneDisabled = isPending || (photoFull && videoFull)
                let dropzoneHint = 'Фото: JPEG/PNG/WebP до 2 МБ · Видео: MP4/WebM до 20 МБ (~1 мин 720p)'
                if (dropzoneDisabled) dropzoneHint = 'Лимит фото и видео исчерпан'
                else if (photoFull) dropzoneHint = `Лимит фото (${MAX_PRODUCT_PHOTOS}) исчерпан. Можно добавить только видео (MP4/WebM до 20 МБ)`
                else if (videoFull) dropzoneHint = `Лимит видео (${MAX_PRODUCT_VIDEOS}) исчерпан. Можно добавить только фото (JPEG/PNG/WebP до 2 МБ)`
                const accept = [
                  !photoFull ? 'image/jpeg,image/png,image/webp' : '',
                  !videoFull ? 'video/mp4,video/webm' : '',
                ].filter(Boolean).join(',')

                return (
                  <>
                    <div
                      onDragOver={(e) => { if (!dropzoneDisabled) { e.preventDefault(); setIsDragging(true) } }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { if (!dropzoneDisabled) handleDrop(e) }}
                      onClick={() => { if (!dropzoneDisabled) fileInputRef.current?.click() }}
                      className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl transition-colors text-center"
                      style={{
                        background: dropzoneDisabled ? 'var(--apex-bg)' : (isDragging ? 'var(--apex-success-bg)' : 'var(--apex-bg)'),
                        border: `2px dashed ${isDragging && !dropzoneDisabled ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
                        color: 'var(--apex-text-secondary)',
                        opacity: dropzoneDisabled ? 0.5 : 1,
                        cursor: dropzoneDisabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Upload size={18} style={{ color: isDragging && !dropzoneDisabled ? 'var(--apex-primary)' : 'var(--apex-text-muted)' }} />
                      <span className="text-[12px] font-medium">
                        {isDragging && !dropzoneDisabled ? 'Отпустите файл' : dropzoneDisabled ? 'Загрузка недоступна' : 'Добавить фото или видео: перетащите, нажмите или Ctrl+V'}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>
                        {dropzoneHint}
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={accept}
                        onChange={handleFileChange}
                        disabled={dropzoneDisabled}
                        className="hidden"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Youtube size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: videoFull ? 'var(--apex-text-muted)' : '#FF0000' }} />
                        <input
                          type="text"
                          value={youtubeInput}
                          onChange={(e) => setYoutubeInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !videoFull) { e.preventDefault(); addYouTube() } }}
                          placeholder={videoFull ? `Лимит видео (${MAX_PRODUCT_VIDEOS}) исчерпан` : 'Ссылка на YouTube или ID видео'}
                          className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] outline-none"
                          style={inputStyle()}
                          disabled={videoFull}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addYouTube}
                        disabled={!youtubeInput.trim() || videoFull}
                        className="px-3 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-50"
                        style={{ background: 'var(--apex-primary)', color: 'white' }}
                      >
                        Добавить
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          </Field>

          {/* Комментарий при покупке */}
          <div
            className="rounded-xl p-3 space-y-3"
            style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
          >
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors"
                style={{
                  background: commentRequired ? 'var(--apex-primary)' : 'transparent',
                  border: `2px solid ${commentRequired ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
                }}
              >
                {commentRequired && <Check size={10} color="white" strokeWidth={3} />}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={commentRequired}
                onChange={(e) => {
                  setCommentRequired(e.target.checked)
                  if (!e.target.checked) {
                    setCommentLabel('')
                    setCommentPlaceholder('')
                  }
                }}
              />
              <MessageSquare size={14} style={{ color: commentRequired ? 'var(--apex-primary)' : 'var(--apex-text-muted)' }} />
              <span className="text-[13px] font-medium" style={{ color: 'var(--apex-text)' }}>
                Требовать комментарий при покупке
              </span>
            </label>

            {commentRequired && (
              <div className="space-y-2 pt-1">
                <Field label="Заголовок поля">
                  <input
                    type="text"
                    value={commentLabel}
                    onChange={(e) => setCommentLabel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={inputStyle()}
                    placeholder="Укажите размер и название шаурмы"
                    maxLength={200}
                  />
                </Field>
                <Field label="Плейсхолдер">
                  <input
                    type="text"
                    value={commentPlaceholder}
                    onChange={(e) => setCommentPlaceholder(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={inputStyle()}
                    placeholder="Чикен терияки маленькая из Папа Донер"
                    maxLength={300}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
              style={{
                background: 'var(--apex-primary)',
                color: 'white',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? (
                <Loader2 size={16} className="inline animate-spin" />
              ) : isEditing ? 'Сохранить' : 'Создать'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
              style={{
                background: 'var(--apex-bg)',
                color: 'var(--apex-text-secondary)',
                border: '1px solid var(--apex-border)',
              }}
            >
              Отмена
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  )
}

// --- Вспомогательные ---

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--apex-text-secondary)' }}>
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[11px] mt-1 font-medium" style={{ color: 'var(--apex-danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function inputStyle(error?: string): React.CSSProperties {
  return {
    background: 'var(--apex-bg)',
    border: `1px solid ${error ? 'var(--apex-danger)' : 'var(--apex-border)'}`,
    color: 'var(--apex-text)',
  }
}

function EmojiInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
        style={inputStyle()}
        placeholder="Вставьте эмодзи"
        maxLength={10}
      />
      <p className="text-[10px] mt-1" style={{ color: 'var(--apex-text-muted)' }}>
        Win + Ю — откроет панель эмодзи с поиском
      </p>
    </div>
  )
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  error?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] outline-none text-left"
        style={inputStyle(error)}
      >
        <span style={{ color: selected ? 'var(--apex-text)' : 'var(--apex-text-muted)' }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--apex-text-muted)' }} />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl py-1.5 shadow-lg max-h-48 overflow-y-auto"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
          }}
        >
          {options.map((o) => {
            const isSelected = o.value === value
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => { onChange(o.value); setIsOpen(false) }}
                className="w-full text-left px-4 py-2 text-[12px] font-medium transition-colors flex items-center justify-between"
                style={{
                  color: isSelected ? 'var(--apex-primary)' : 'var(--apex-text)',
                  background: isSelected ? 'var(--apex-success-bg)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--apex-bg)' }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isSelected ? 'var(--apex-success-bg)' : 'transparent' }}
              >
                {o.label}
                {isSelected && <Check size={14} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

