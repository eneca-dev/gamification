'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Upload, Trash2, Loader2 } from 'lucide-react'

import type { ShopProductWithCategory, ShopCategory } from '@/modules/shop/index.client'
import type { ProductFormData } from '../types'

interface ProductFormModalProps {
  product: ShopProductWithCategory | null
  categories: ShopCategory[]
  onSave: (data: ProductFormData, imageFile: File | null) => void
  onClose: () => void
  isPending: boolean
}

export function ProductFormModal({ product, categories, onSave, onClose, isPending }: ProductFormModalProps) {
  const isEditing = !!product
  const activeCategories = categories.filter((c) => c.is_active || c.id === product?.category_id)
  const defaultCategoryId = product?.category_id ?? activeCategories[0]?.id ?? ''

  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(product?.price ?? 0)
  const [categoryId, setCategoryId] = useState(defaultCategoryId)
  const [emoji, setEmoji] = useState(product?.emoji ?? '')
  const [stock, setStock] = useState<string>(product?.stock != null ? String(product.stock) : '')
  const [sortOrder, setSortOrder] = useState(product?.sort_order ?? 0)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url ?? null)
  const [removeImage, setRemoveImage] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedCategory = categories.find((c) => c.id === categoryId)
  const isPhysical = selectedCategory?.is_physical ?? false

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, image: 'Формат: JPEG, PNG или WebP' }))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: 'Максимум 2 МБ' }))
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setRemoveImage(false)
    setErrors((prev) => {
      const next = { ...prev }
      delete next.image
      return next
    })
  }

  function handleRemoveImage() {
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Название обязательно'
    if (price <= 0) errs.price = 'Цена должна быть больше 0'
    if (!categoryId) errs.category_id = 'Выберите категорию'
    if (isPhysical && stock === '') errs.stock = 'Укажите количество для физического товара'
    if (isPhysical && stock !== '') {
      const stockNum = parseInt(stock, 10)
      if (isNaN(stockNum) || stockNum < 0) errs.stock = 'Количество должно быть >= 0'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const data: ProductFormData = {
      name: name.trim(),
      description: description.trim() || null,
      price,
      category_id: categoryId,
      image_url: removeImage ? null : (imagePreview && !imageFile ? product?.image_url ?? null : null),
      emoji: emoji.trim() || null,
      stock: isPhysical ? parseInt(stock, 10) : null,
      sort_order: sortOrder,
    }

    onSave(data, imageFile)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 animate-scale-in"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold" style={{ color: 'var(--apex-text)' }}>
            {isEditing ? 'Редактировать товар' : 'Новый товар'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            {/* Цена */}
            <Field label="Цена (коины)" error={errors.price}>
              <input
                type="number"
                value={price || ''}
                onChange={(e) => setPrice(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                style={inputStyle(errors.price)}
                min={1}
              />
            </Field>

            {/* Категория */}
            <Field label="Категория" error={errors.category_id}>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                style={inputStyle(errors.category_id)}
              >
                <option value="">Выберите...</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Эмодзи */}
            <Field label="Эмодзи">
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                style={inputStyle()}
                placeholder="📦"
                maxLength={10}
              />
            </Field>

            {/* Stock */}
            <Field
              label={isPhysical ? 'Количество' : 'Количество (безлимит)'}
              error={errors.stock}
            >
              <input
                type="number"
                value={isPhysical ? stock : ''}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                style={inputStyle(errors.stock)}
                min={0}
                disabled={!isPhysical}
                placeholder={isPhysical ? '0' : 'Безлимит'}
              />
            </Field>
          </div>

          {/* Порядок сортировки */}
          <Field label="Порядок сортировки">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
              style={inputStyle()}
              min={0}
            />
          </Field>

          {/* Изображение */}
          <Field label="Изображение" error={errors.image}>
            <div className="space-y-3">
              {imagePreview && (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-xl"
                    style={{ border: '1px solid var(--apex-border)' }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--apex-danger)', color: 'white' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
              <label
                className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-[13px] font-medium w-fit"
                style={{
                  background: 'var(--apex-bg)',
                  border: '1px solid var(--apex-border)',
                  color: 'var(--apex-text-secondary)',
                }}
              >
                <Upload size={14} />
                {imagePreview ? 'Заменить' : 'Загрузить'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                JPEG, PNG или WebP, до 2 МБ
              </p>
            </div>
          </Field>

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

