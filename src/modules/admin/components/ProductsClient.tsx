'use client'

import { useState, useTransition, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight, Check, X, HelpCircle, List, LayoutGrid } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'
import {
  createCategory,
  updateCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  computePriceCrystals,
} from '@/modules/shop/index.client'

import { CrystalRatePanel } from './CrystalRatePanel'
import { ProductFormModal } from './ProductFormModal'
import type { ProductFormData } from '../types'
import type { ShopProductWithCategory, ShopCategory } from '@/modules/shop/index.client'

interface ProductsClientProps {
  products: ShopProductWithCategory[]
  categories: ShopCategory[]
  currentRate: number
}

type InlineProductField = 'category_id' | 'cost_byn' | 'coefficient' | 'stock'

type ProductStatus = 'active' | 'coming_soon' | 'inactive'

type NumericOp = '>=' | '<=' | '!=' | '>' | '<' | '='

interface NumericFilter {
  op: NumericOp
  value: number
}

interface ParsedAdminFilter {
  status?: ('active' | 'inactive' | 'coming_soon')[]
  categories?: string[]
  coefficient?: NumericFilter
  price?: NumericFilter
  costByn?: NumericFilter
  stock?: NumericFilter
  hasImage?: boolean
  hasEmoji?: boolean
}

interface FilterToken { key: string; value: string; raw: string; negated: boolean; start: number }

type FilterFieldKey = 'status' | 'categories' | 'coefficient' | 'price' | 'costByn' | 'stock' | 'hasImage'

interface FieldDef {
  displayKey: string
  label: string
  fieldKey: FilterFieldKey
  color: string       // фон бейджа в дропдауне
  textColor: string   // текст бейджа в дропдауне
  overlayKeyColor: string  // цвет ключа "статус:" в оверлее инпута
  isNumeric?: boolean
  multiple?: boolean
  values: Array<{ label: string; insert: string }>
}

const FILTER_KEY_MAP: Record<string, FilterFieldKey> = {
  статус: 'status', status: 'status',
  категория: 'categories', кат: 'categories', category: 'categories',
  коэф: 'coefficient', коэффициент: 'coefficient', coefficient: 'coefficient',
  цена: 'price', price: 'price',
  byn: 'costByn', себестоимость: 'costByn',
  остаток: 'stock', stock: 'stock', сток: 'stock',
  картинка: 'hasImage', фото: 'hasImage', изображение: 'hasImage',
}

// Global regex — reset lastIndex before each use!
const FILTER_TOKEN_RE = /(-?)([^\s:]+):(?:"([^"]*)"|(\S+))/g

function parseFilterTokens(input: string): FilterToken[] {
  const tokens: FilterToken[] = []
  FILTER_TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FILTER_TOKEN_RE.exec(input)) !== null) {
    if (tokens.length >= 20) break
    const key = m[2].toLowerCase()
    if (!FILTER_KEY_MAP[key]) continue
    tokens.push({ key, value: (m[3] ?? m[4] ?? '').toLowerCase(), raw: m[0], negated: m[1] === '-', start: m.index })
  }
  return tokens
}

function getProductStatus(product: ShopProductWithCategory): ProductStatus {
  if (product.is_active) return 'active'
  if (product.is_coming_soon) return 'coming_soon'
  return 'inactive'
}

function compareNum(a: number, op: NumericOp, b: number): boolean {
  if (op === '>=') return a >= b
  if (op === '<=') return a <= b
  if (op === '!=') return a !== b
  if (op === '>') return a > b
  if (op === '<') return a < b
  return a === b
}

function buildAdminFilter(tokens: FilterToken[]): ParsedAdminFilter {
  const result: ParsedAdminFilter = {}
  const statusMap: Record<string, 'active' | 'inactive' | 'coming_soon'> = {
    активен: 'active', активный: 'active', active: 'active',
    неактивен: 'inactive', неактивный: 'inactive', inactive: 'inactive',
    скоро: 'coming_soon', coming_soon: 'coming_soon',
  }

  for (const t of tokens) {
    const field = FILTER_KEY_MAP[t.key]
    if (!field) continue

    if (field === 'status') {
      const s = statusMap[t.value]
      if (s) result.status = [...(result.status ?? []), s]
    } else if (field === 'categories') {
      result.categories = [...(result.categories ?? []), t.value]
    } else if (field === 'hasImage') {
      if (t.value === 'эмодзи') {
        result.hasImage = false
        result.hasEmoji = true
      } else {
        const isTrue = ['есть', 'да', 'true', 'yes'].includes(t.value)
        const isFalse = ['нет', 'нету', 'no', 'false'].includes(t.value)
        if (isTrue) result.hasImage = !t.negated
        else if (isFalse) result.hasImage = t.negated
      }
    } else {
      const nm = t.value.match(/^(>=|<=|!=|>|<|=)\s*(\d+(?:[.,]\d+)?)/)
      if (nm) {
        result[field as 'coefficient' | 'price' | 'costByn' | 'stock'] = {
          op: nm[1] as NumericOp,
          value: parseFloat(nm[2].replace(',', '.')),
        }
      }
    }
  }

  return result
}

function applyParsedFilter(
  p: ShopProductWithCategory,
  filter: ParsedAdminFilter,
  effectiveRate: number
): boolean {
  if (filter.status?.length && !filter.status.includes(getProductStatus(p))) return false
  if (filter.categories?.length) {
    const catName = (p.category?.name ?? '').toLowerCase()
    if (!filter.categories.some(c => catName.includes(c))) return false
  }
  if (filter.coefficient && !compareNum(p.coefficient, filter.coefficient.op, filter.coefficient.value)) return false
  if (filter.price && !compareNum(computePriceCrystals(p.cost_byn, p.coefficient, effectiveRate), filter.price.op, filter.price.value)) return false
  if (filter.costByn && !compareNum(p.cost_byn, filter.costByn.op, filter.costByn.value)) return false
  if (filter.stock && !compareNum(p.stock ?? 0, filter.stock.op, filter.stock.value)) return false
  if (filter.hasImage !== undefined && !!p.image_url !== filter.hasImage) return false
  if (filter.hasEmoji !== undefined && !!p.emoji !== filter.hasEmoji) return false
  return true
}

export function ProductsClient({ products: initialProducts, categories: initialCategories, currentRate }: ProductsClientProps) {
  const [products, setProducts] = useState(initialProducts)
  const [categories, setCategories] = useState(initialCategories)
  const [isCatPending, startCatTransition] = useTransition()
  const [isProductPending, startProductTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  // Курс кристаллов — реальный + preview
  const [previewRate, setPreviewRate] = useState<number | null>(null)
  const effectiveRate = previewRate ?? currentRate

  // Товары — фильтр, поиск и модал
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingProduct, setEditingProduct] = useState<ShopProductWithCategory | null>(null)
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [expandedDescriptionId, setExpandedDescriptionId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')
  const [filterQuery, setFilterQuery] = useState('')

  // Inline-редактирование товаров
  const [inlineEdit, setInlineEdit] = useState<{
    productId: string
    field: InlineProductField
    value: string
  } | null>(null)

  // Категории — секция
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', slug: '', description: '', is_physical: true, is_countable: true })
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editCatField, setEditCatField] = useState<'name' | 'slug' | 'description' | 'is_physical' | null>(null)
  const [editCatValue, setEditCatValue] = useState('')

  const filterTokens = useMemo(() => parseFilterTokens(filterQuery), [filterQuery])
  const parsedFilter = useMemo(() => buildAdminFilter(filterTokens), [filterTokens])

  const filteredProducts = products
    .filter((p) => categoryFilter === 'all' || p.category?.slug === categoryFilter)
    .filter((p) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.category?.name.toLowerCase().includes(q) ?? false)
      )
    })
    .filter((p) => applyParsedFilter(p, parsedFilter, effectiveRate))

  function showNotification(msg: string) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  // --- Категории ---

  function startCatEdit(cat: ShopCategory, field: 'name' | 'slug' | 'description' | 'is_physical') {
    setEditingCatId(cat.id)
    setEditCatField(field)
    setEditCatValue(
      field === 'description' ? (cat.description ?? '')
        : field === 'is_physical' ? String(cat.is_physical)
        : cat[field]
    )
    setError(null)
  }

  function cancelCatEdit() {
    setEditingCatId(null)
    setEditCatField(null)
    setEditCatValue('')
  }

  function saveCatEdit(id: string) {
    if (!editCatField) return

    if (editCatField === 'is_physical') {
      submitCatUpdate(id, { is_physical: editCatValue === 'true' })
      return
    }

    const value = editCatValue.trim()
    if (editCatField !== 'description' && !value) {
      setError(`${editCatField === 'name' ? 'Название' : 'Slug'} обязателен`)
      return
    }

    if (editCatField === 'slug') {
      if (!/^[a-z][a-z0-9_]*$/.test(value)) {
        setError('Slug: только строчные латинские буквы, цифры и _, начинается с буквы')
        return
      }
      const isDuplicate = categories.some((c) => c.id !== id && c.slug === value)
      if (isDuplicate) {
        setError('Slug уже используется другой категорией')
        return
      }
    }

    submitCatUpdate(id, { [editCatField]: editCatField === 'description' ? (value || null) : value })
  }

  function toggleCatActive(id: string, current: boolean) {
    submitCatUpdate(id, { is_active: !current })
  }

  function submitCatUpdate(id: string, fields: Record<string, unknown>) {
    const prev = categories
    const prevProducts = products
    setCategories((cats) => cats.map((c) => (c.id === id ? { ...c, ...fields } : c)))

    // При отключении исчисляемости — сбросить stock у товаров этой категории
    if (fields.is_countable === false) {
      setProducts((items) => items.map((p) => p.category_id === id ? { ...p, stock: null } : p))
    }

    cancelCatEdit()

    startCatTransition(async () => {
      const result = await updateCategory({ id, ...fields })
      if (!result.success) {
        setCategories(prev)
        setProducts(prevProducts)
        setError(result.error)
      }
    })
  }

  function handleCreateCategory() {
    if (!newCat.name.trim() || !newCat.slug.trim()) {
      setError('Название и slug обязательны')
      return
    }
    if (!/^[a-z][a-z0-9_]*$/.test(newCat.slug)) {
      setError('Slug: только строчные латинские буквы, цифры и _, начинается с буквы')
      return
    }
    if (categories.some((c) => c.slug === newCat.slug)) {
      setError('Slug уже используется другой категорией')
      return
    }

    startCatTransition(async () => {
      const result = await createCategory({
        ...newCat,
        description: newCat.description.trim() || null,
      })
      if (!result.success) {
        setError(result.error)
      } else {
        setCategories((prev) => [
          ...prev,
          {
            id: result.id,
            ...newCat,
            description: newCat.description.trim() || null,
            is_active: true,
            sort_order: 0,
            created_at: new Date().toISOString(),
          },
        ])
        setNewCat({ name: '', slug: '', description: '', is_physical: false, is_countable: false })
        setIsCreatingCategory(false)
        showNotification('Категория создана')
      }
    })
  }

  // --- Товары ---

  function toggleProductActive(product: ShopProductWithCategory) {
    const next = !product.is_active

    // Запрет активации товара с нулевым остатком (для исчисляемых)
    if (next && product.category?.is_countable && (product.stock ?? 0) === 0) {
      setError('Нельзя активировать товар с нулевым остатком. Сначала укажите количество.')
      return
    }

    const prev = products
    setProducts((items) => items.map((p) => (p.id === product.id ? { ...p, is_active: next } : p)))

    startProductTransition(async () => {
      const result = await updateProduct({ id: product.id, is_active: next })
      if (!result.success) {
        setProducts(prev)
        setError(result.error)
      }
    })
  }

  function setProductStatus(product: ShopProductWithCategory, newStatus: ProductStatus) {
    if (newStatus === 'active' && product.category?.is_countable && (product.stock ?? 0) === 0) {
      setError('Нельзя активировать товар с нулевым остатком. Сначала укажите количество.')
      return
    }

    const fields =
      newStatus === 'active'
        ? { is_active: true, is_coming_soon: false }
        : newStatus === 'coming_soon'
        ? { is_active: false, is_coming_soon: true }
        : { is_active: false, is_coming_soon: false }

    const prev = products
    setProducts((items) => items.map((p) => (p.id === product.id ? { ...p, ...fields } : p)))

    startProductTransition(async () => {
      const result = await updateProduct({ id: product.id, ...fields })
      if (!result.success) {
        setProducts(prev)
        setError(result.error)
      }
    })
  }

  function handleDeleteProduct(id: string) {
    const prev = products
    setProducts((items) => items.filter((p) => p.id !== id))
    setDeletingProductId(null)

    startProductTransition(async () => {
      const result = await deleteProduct(id)
      if (!result.success) {
        setProducts(prev)
        setError(result.error)
      } else {
        showNotification('Товар удалён')
      }
    })
  }

  // --- Inline edit ---

  function startInlineEdit(productId: string, field: InlineProductField, currentValue: string) {
    setInlineEdit({ productId, field, value: currentValue })
  }

  function cancelInlineEdit() {
    setInlineEdit(null)
  }

  function saveInlineEdit() {
    if (!inlineEdit) return
    const { productId, field, value } = inlineEdit

    let updatePayload: Record<string, unknown> = {}

    if (field === 'cost_byn') {
      const num = parseFloat(value.replace(',', '.'))
      if (isNaN(num) || num <= 0) {
        setError('Себестоимость должна быть больше 0')
        return
      }
      updatePayload = { cost_byn: num }
    } else if (field === 'coefficient') {
      const num = parseFloat(value.replace(',', '.'))
      if (isNaN(num) || num <= 0) {
        setError('Коэффициент должен быть больше 0')
        return
      }
      updatePayload = { coefficient: num }
    } else if (field === 'stock') {
      if (value === '') {
        updatePayload = { stock: null }
      } else {
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 0) {
          setError('Количество должно быть >= 0')
          return
        }
        updatePayload = { stock: num }
        // При обнулении остатка — товар автоматически деактивируется
        if (num === 0) {
          updatePayload.is_active = false
        }
      }
    } else if (field === 'category_id') {
      if (!value) {
        setError('Выберите категорию')
        return
      }
      updatePayload = { category_id: value }
    }

    const prev = products
    const cat = field === 'category_id' ? categories.find((c) => c.id === value) : null
    setProducts((items) =>
      items.map((p) => {
        if (p.id !== productId) return p
        const updated = { ...p, ...updatePayload }
        if (cat) {
          updated.category = { name: cat.name, slug: cat.slug, is_physical: cat.is_physical, is_countable: cat.is_countable, is_active: cat.is_active }
          updated.category_id = cat.id
        }
        if (field === 'cost_byn' || field === 'coefficient') {
          updated.price = computePriceCrystals(updated.cost_byn, updated.coefficient, effectiveRate)
        }
        return updated
      })
    )
    cancelInlineEdit()

    startProductTransition(async () => {
      const result = await updateProduct({ id: productId, ...updatePayload })
      if (!result.success) {
        setProducts(prev)
        setError(result.error)
      }
    })
  }

  function handleProductSave(data: ProductFormData, imageFile: File | null) {
    startProductTransition(async () => {
      let imageUrl = data.image_url

      // Загружаем новое изображение (должно завершиться до optimistic update)
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        const res = await fetch('/api/admin/upload-product-image', { method: 'POST', body: fd })
        const uploadResult = await res.json() as { success: true; url: string } | { success: false; error: string }
        if (!uploadResult.success) {
          setError(uploadResult.error)
          return
        }
        imageUrl = uploadResult.url

        if (editingProduct?.image_url) {
          await deleteProductImage(editingProduct.image_url)
        }
      }

      if (!imageFile && !imageUrl && editingProduct?.image_url) {
        await deleteProductImage(editingProduct.image_url)
      }

      const payload = { ...data, image_url: imageUrl }
      const cat = categories.find((c) => c.id === data.category_id)
      const categoryData = cat
        ? { name: cat.name, slug: cat.slug, is_physical: cat.is_physical, is_countable: cat.is_countable, is_active: cat.is_active }
        : { name: '', slug: '', is_physical: false, is_countable: false, is_active: true }
      const computedPrice = computePriceCrystals(payload.cost_byn, payload.coefficient, effectiveRate)
      // Stock = 0 (исчисляемая категория) → товар автоматически неактивен (синхронно с сервером)
      const forceInactive = !!cat?.is_countable && payload.stock === 0

      // Optimistic update
      const prev = products
      if (editingProduct) {
        setProducts((list) =>
          list.map((p) => {
            if (p.id !== editingProduct.id) return p
            const updated = { ...p, ...payload, price: computedPrice, category: categoryData }
            if (forceInactive) updated.is_active = false
            return updated
          })
        )
      } else {
        const tempId = `temp-${Date.now()}`
        setProducts((list) => [
          {
            id: tempId,
            ...payload,
            price: computedPrice,
            is_active: !forceInactive,
            is_coming_soon: false,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            category: categoryData,
            effect: null,
          },
          ...list,
        ])
      }

      setEditingProduct(null)
      setIsCreatingProduct(false)

      // Серверный вызов
      if (editingProduct) {
        const result = await updateProduct({ id: editingProduct.id, ...payload })
        if (!result.success) {
          setProducts(prev)
          setError(result.error)
          return
        }
        showNotification('Товар обновлён')
      } else {
        const result = await createProduct(payload)
        if (!result.success) {
          setProducts(prev)
          setError(result.error)
          return
        }
        // Заменяем temp ID на реальный
        setProducts((list) =>
          list.map((p) => (p.id.startsWith('temp-') ? { ...p, id: result.id } : p))
        )
        showNotification('Товар создан')
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Toast — через портал, чтобы обойти transform containing block */}
      {notification && createPortal(
        <div className="fixed top-6 right-6 z-50 animate-fade-in-up">
          <div
            className="rounded-xl px-5 py-3 text-[13px] font-semibold shadow-lg"
            style={{
              background: 'var(--apex-success-bg)',
              color: 'var(--apex-success-text)',
              border: '1px solid rgba(var(--apex-primary-rgb), 0.15)',
            }}
          >
            {notification}
          </div>
        </div>,
        document.body,
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl px-5 py-3 text-[13px] font-medium"
          style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
        >
          {error}
          <button onClick={() => setError(null)} className="ml-3 font-bold">x</button>
        </div>
      )}

      {/* Курс кристаллов */}
      <CrystalRatePanel
        currentRate={currentRate}
        previewRate={previewRate}
        onPreviewRateChange={setPreviewRate}
        onError={setError}
        onApplied={(rate) => showNotification(`Курс изменён: 1 BYN = ${rate} кристаллов`)}
      />

      {/* === КАТЕГОРИИ === */}
      <div
        className="rounded-2xl overflow-hidden"
        data-onboarding="admin-products-categories"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 cursor-pointer"
          onClick={() => setCategoriesExpanded(!categoriesExpanded)}
        >
          <div className="flex items-center gap-2">
            {categoriesExpanded ? (
              <ChevronDown size={16} style={{ color: 'var(--apex-text-muted)' }} />
            ) : (
              <ChevronRight size={16} style={{ color: 'var(--apex-text-muted)' }} />
            )}
            <span className="text-[14px] font-semibold" style={{ color: 'var(--apex-text)' }}>
              Категории
            </span>
            <span className="text-[12px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
              ({categories.length})
            </span>
          </div>
          {categoriesExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsCreatingCategory(!isCreatingCategory)
              }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
              style={{ background: 'var(--apex-primary)', color: 'white' }}
            >
              <Plus size={14} className="inline -translate-y-[1px] mr-1" />
              Добавить
            </button>
          )}
        </div>

        {categoriesExpanded && (
          <>
            {/* Форма создания категории */}
            {isCreatingCategory && (
              <div
                className="px-5 py-4 space-y-3"
                style={{ borderTop: '1px solid var(--apex-border)', background: 'var(--apex-bg)' }}
              >
                <div className="grid grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={newCat.name}
                    onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                    placeholder="Название"
                    className="px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={catInputStyle}
                  />
                  <div className="relative">
                    <input
                      type="text"
                      value={newCat.slug}
                      onChange={(e) => setNewCat({ ...newCat, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                      placeholder="slug"
                      className="w-full px-3 py-2 pr-8 rounded-lg text-[13px] outline-none font-mono"
                      style={catInputStyle}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2">
                      <SlugHelp />
                    </span>
                  </div>
                  <input
                    type="text"
                    value={newCat.description}
                    onChange={(e) => setNewCat({ ...newCat, description: e.target.value })}
                    placeholder="Описание"
                    className="px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={catInputStyle}
                  />
                  <div className="flex items-center gap-4 px-3 py-2">
                    <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--apex-text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={newCat.is_physical}
                        onChange={(e) => setNewCat({ ...newCat, is_physical: e.target.checked, is_countable: e.target.checked ? newCat.is_countable : false })}
                        className="rounded"
                      />
                      Физический
                    </label>
                    <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--apex-text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={newCat.is_countable}
                        onChange={(e) => setNewCat({ ...newCat, is_countable: e.target.checked })}
                        className="rounded"
                      />
                      Исчисляемый
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1" />
                  <button
                    onClick={handleCreateCategory}
                    disabled={isCatPending}
                    className="px-4 py-1.5 rounded-lg text-[12px] font-semibold"
                    style={{ background: 'var(--apex-primary)', color: 'white', opacity: isCatPending ? 0.6 : 1 }}
                  >
                    Создать
                  </button>
                  <button
                    onClick={() => setIsCreatingCategory(false)}
                    className="px-4 py-1.5 rounded-lg text-[12px] font-semibold"
                    style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-muted)', border: '1px solid var(--apex-border)' }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {/* Таблица категорий */}
            <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '13%' }} />
              </colgroup>
              <thead>
                <tr style={{ borderTop: '1px solid var(--apex-border)', borderBottom: '1px solid var(--apex-border)' }}>
                  {['Название', 'Slug', 'Описание', 'Тип', 'Исчисляемый', 'Статус'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[12px] font-semibold px-5 py-2.5"
                      style={{ color: 'var(--apex-text-secondary)' }}
                    >
                      {h}
                      {h === 'Slug' && (
                        <span className="inline-block ml-1 align-middle">
                          <SlugHelp size={12} />
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const isEditingThis = editingCatId === cat.id

                  return (
                    <tr key={cat.id} className="group" style={{ borderBottom: '1px solid var(--apex-border)' }}>
                      {/* Название */}
                      <td className="px-5 py-2.5">
                        {isEditingThis && editCatField === 'name' ? (
                          <CatInlineEdit
                            value={editCatValue}
                            onChange={setEditCatValue}
                            onSave={() => saveCatEdit(cat.id)}
                            onCancel={cancelCatEdit}
                          />
                        ) : (
                          <CatEditableCell onClick={() => startCatEdit(cat, 'name')}>
                            <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                              {cat.name}
                            </span>
                          </CatEditableCell>
                        )}
                      </td>

                      {/* Slug */}
                      <td className="px-5 py-2.5">
                        {isEditingThis && editCatField === 'slug' ? (
                          <CatInlineEdit
                            value={editCatValue}
                            onChange={(v) => setEditCatValue(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            onSave={() => saveCatEdit(cat.id)}
                            onCancel={cancelCatEdit}
                          />
                        ) : (
                          <CatEditableCell onClick={() => startCatEdit(cat, 'slug')}>
                            <code
                              className="text-[11px] font-mono px-1.5 py-0.5 rounded-lg"
                              style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-muted)' }}
                            >
                              {cat.slug}
                            </code>
                          </CatEditableCell>
                        )}
                      </td>

                      {/* Описание */}
                      <td className="px-5 py-2.5 max-w-[200px]">
                        {isEditingThis && editCatField === 'description' ? (
                          <CatInlineEdit
                            value={editCatValue}
                            onChange={setEditCatValue}
                            onSave={() => saveCatEdit(cat.id)}
                            onCancel={cancelCatEdit}
                            placeholder="Описание"
                          />
                        ) : (
                          <CatEditableCell onClick={() => startCatEdit(cat, 'description')}>
                            <span
                              className="text-[12px] truncate block"
                              style={{ color: cat.description ? 'var(--apex-text-secondary)' : 'var(--apex-text-muted)' }}
                            >
                              {cat.description ?? '—'}
                            </span>
                          </CatEditableCell>
                        )}
                      </td>

                      {/* Тип */}
                      <td className="px-5 py-2.5">
                        <CatTypeDropdown
                          catId={cat.id}
                          isPhysical={cat.is_physical}
                          isOpen={editingCatId === cat.id && editCatField === 'is_physical'}
                          onToggle={() => {
                            if (editingCatId === cat.id && editCatField === 'is_physical') {
                              cancelCatEdit()
                            } else {
                              startCatEdit(cat, 'is_physical')
                            }
                          }}
                          onSelect={(val) => {
                            cancelCatEdit()
                            if (val !== cat.is_physical) {
                              const updates: Record<string, unknown> = { is_physical: val }
                              if (!val) updates.is_countable = false
                              submitCatUpdate(cat.id, updates)
                            }
                          }}
                        />
                      </td>

                      {/* Исчисляемый */}
                      <td className="px-5 py-2.5">
                        <ToggleSwitch
                          checked={cat.is_countable}
                          onChange={() => submitCatUpdate(cat.id, { is_countable: !cat.is_countable })}
                          disabled={isCatPending || !cat.is_physical}
                          label={cat.is_countable ? 'Да' : 'Нет'}
                        />
                      </td>

                      {/* Статус */}
                      <td className="px-5 py-2.5">
                        <ToggleSwitch
                          checked={cat.is_active}
                          onChange={() => toggleCatActive(cat.id, cat.is_active)}
                          disabled={isCatPending}
                          label={cat.is_active ? 'Активна' : 'Неактивна'}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {/* === ТОВАРЫ === */}
      <div
        className="rounded-2xl overflow-hidden"
        data-onboarding="admin-products-table"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        {/* Заголовок товаров */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--apex-border)' }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-[14px] font-semibold shrink-0" style={{ color: 'var(--apex-text)' }}>
              Товары
            </span>
            <CategoryFilters
              categories={categories}
              products={products}
              categoryFilter={categoryFilter}
              onFilterChange={setCategoryFilter}
            />
          </div>
          <div className="flex items-center gap-3">
            {/* Переключатель вида */}
            <div
              className="flex items-center rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--apex-border)' }}
            >
              <button
                onClick={() => setViewMode('list')}
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{
                  background: viewMode === 'list' ? 'var(--apex-primary)' : 'transparent',
                  color: viewMode === 'list' ? 'white' : 'var(--apex-text-muted)',
                }}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{
                  background: viewMode === 'cards' ? 'var(--apex-primary)' : 'transparent',
                  color: viewMode === 'cards' ? 'white' : 'var(--apex-text-muted)',
                }}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
            {/* Поиск */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--apex-text-muted)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск..."
                className="pl-8 pr-3 py-1.5 rounded-lg text-[12px] outline-none w-48"
                style={{
                  background: 'var(--apex-bg)',
                  border: '1px solid var(--apex-border)',
                  color: 'var(--apex-text)',
                }}
              />
            </div>
            <button
              onClick={() => setIsCreatingProduct(true)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
              style={{ background: 'var(--apex-primary)', color: 'white' }}
            >
              <Plus size={14} className="inline -translate-y-[1px] mr-1" />
              Добавить товар
            </button>
          </div>
        </div>

        {/* Строка фильтра */}
        <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--apex-border)' }}>
          <FilterInput value={filterQuery} onChange={setFilterQuery} categories={categories} />
        </div>

        {/* Вид: карточки */}
        {viewMode === 'cards' && (
          <div>
            {filteredProducts.length === 0 ? (
              <p className="text-center py-12 text-[13px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
                {searchQuery.trim() ? 'Ничего не найдено' : 'Нет товаров'}
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5">
                {filteredProducts.map((product) => {
                  const isConfirmingDelete = deletingProductId === product.id
                  const isDescExpanded = expandedDescriptionId === product.id
                  const outOfStock = !product.is_coming_soon && product.category?.is_countable && product.stock !== null && product.stock === 0
                  const lowStock = !product.is_coming_soon && product.category?.is_countable && product.stock !== null && product.stock > 0 && product.stock <= 5
                  return (
                    <div
                      key={product.id}
                      className="rounded-2xl overflow-hidden card-hover flex flex-col"
                      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
                    >
                      {/* Зона картинки / эмодзи */}
                      <div
                        className="h-36 flex items-center justify-center relative overflow-hidden"
                        style={{ background: product.image_url ? 'transparent' : 'var(--apex-emoji-bg)' }}
                      >
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-5xl">{product.emoji || <span style={{ color: '#ccc' }}>?</span>}</span>
                        )}
                        {product.is_coming_soon && (
                          <span
                            className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                            style={{ background: 'var(--apex-warning-text)', color: 'white' }}
                          >
                            Скоро в продаже
                          </span>
                        )}
                        {outOfStock && (
                          <span
                            className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                            style={{ background: 'var(--apex-danger)', color: 'white' }}
                          >
                            Нет в наличии
                          </span>
                        )}
                        {lowStock && (
                          <span
                            className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                            style={{ background: 'var(--apex-warning-text)', color: 'white' }}
                          >
                            Осталось: {product.stock}
                          </span>
                        )}
                      </div>
                      {/* Детали товара */}
                      <div className="p-4 flex flex-col flex-1" style={{ background: 'var(--surface-elevated)' }}>
                        <div className="mb-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                            {product.category?.name ?? '—'}
                          </span>
                        </div>
                        <h3 className="text-[13px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                          {product.name}
                        </h3>
                        {product.description ? (
                          <p
                            onClick={() => setExpandedDescriptionId(isDescExpanded ? null : product.id)}
                            className="text-[11px] mt-0.5 mb-2 overflow-hidden cursor-pointer"
                            style={{
                              color: 'var(--text-muted)',
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: isDescExpanded ? 'unset' : 2,
                            }}
                          >
                            {product.description}
                          </p>
                        ) : (
                          <div className="mb-3" />
                        )}
                        <div className="mt-auto pt-2 flex flex-col gap-2">
                          <CoinStatic
                            amount={computePriceCrystals(product.cost_byn, product.coefficient, effectiveRate)}
                            size="sm"
                          />
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ProductStatusDropdown
                                status={getProductStatus(product)}
                                onChange={(s) => setProductStatus(product, s)}
                                disabled={isProductPending || !product.category?.is_active}
                              />
                            </div>
                            {isConfirmingDelete ? (
                              <>
                                <span className="text-[10px] font-medium" style={{ color: 'var(--apex-danger)' }}>
                                  Удалить?
                                </span>
                                <button
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setDeletingProductId(null)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{ color: 'var(--apex-text-muted)' }}
                                >
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingProduct(product)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                                  style={{ color: 'var(--apex-text-muted)' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--apex-primary)'; e.currentTarget.style.background = 'var(--apex-success-bg)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--apex-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => setDeletingProductId(product.id)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                                  style={{ color: 'var(--apex-text-muted)' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--apex-danger)'; e.currentTarget.style.background = 'var(--apex-error-bg)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--apex-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Таблица товаров */}
        {viewMode === 'list' && <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '60px' }} />
            <col />
            <col style={{ width: '160px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '180px' }} />
            <col style={{ width: '120px' }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--apex-border)' }}>
              {['', 'Название', 'Категория', 'BYN', 'Коэф.', 'Цена', 'Остаток', 'Статус', ''].map((h, i) => (
                <th
                  key={i}
                  className="text-left text-[12px] font-semibold px-5 py-2.5"
                  style={{ color: 'var(--apex-text-secondary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
                    {searchQuery.trim() ? 'Ничего не найдено' : 'Нет товаров'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => {
                const isInlineEditing = inlineEdit?.productId === product.id
                const isConfirmingDelete = deletingProductId === product.id

                return (
                  <tr key={product.id} className="group" style={{ borderBottom: '1px solid var(--apex-border)' }}>
                    {/* Изображение */}
                    <td className="px-5 py-2.5 w-12">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl overflow-hidden"
                        style={{
                          background: product.image_url ? 'var(--apex-bg)' : 'var(--apex-emoji-bg)',
                          border: '1px solid var(--apex-border)',
                        }}
                      >
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                        ) : product.emoji ? (
                          product.emoji
                        ) : (
                          <span className="text-[16px]" style={{ color: '#ccc' }}>?</span>
                        )}
                      </div>
                    </td>

                    {/* Название */}
                    <td className="px-5 py-2.5">
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                        {product.name}
                      </span>
                      {product.description && (
                        <p
                          className={`text-[11px] mt-0.5 max-w-[250px] cursor-pointer ${expandedDescriptionId === product.id ? 'whitespace-normal' : 'truncate'}`}
                          style={{ color: 'var(--apex-text-muted)' }}
                          onClick={() => setExpandedDescriptionId(expandedDescriptionId === product.id ? null : product.id)}
                        >
                          {product.description}
                        </p>
                      )}
                    </td>

                    {/* Категория — inline editable */}
                    <td className="px-5 py-2.5">
                      {isInlineEditing && inlineEdit.field === 'category_id' ? (
                        <InlineSelect
                          value={inlineEdit.value}
                          onChange={(v) => setInlineEdit({ ...inlineEdit, value: v })}
                          onSave={saveInlineEdit}
                          onCancel={cancelInlineEdit}
                          options={categories.filter((c) => c.is_active || c.id === product.category_id).map((c) => ({
                            value: c.id,
                            label: c.name,
                          }))}
                        />
                      ) : (
                        <InlineEditableCell onClick={() => startInlineEdit(product.id, 'category_id', product.category_id)}>
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                            style={{ background: 'var(--tag-teal-bg)', color: 'var(--tag-teal-text)' }}
                          >
                            {product.category?.name ?? '—'}
                          </span>
                        </InlineEditableCell>
                      )}
                    </td>

                    {/* BYN (cost_byn) — inline editable */}
                    <td className="px-5 py-2.5">
                      {isInlineEditing && inlineEdit.field === 'cost_byn' ? (
                        <InlineNumberInput
                          value={inlineEdit.value}
                          onChange={(v) => setInlineEdit({ ...inlineEdit, value: v })}
                          onSave={saveInlineEdit}
                          onCancel={cancelInlineEdit}
                        />
                      ) : (
                        <InlineEditableCell onClick={() => startInlineEdit(product.id, 'cost_byn', String(product.cost_byn))}>
                          <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--apex-text)' }}>
                            {product.cost_byn}
                          </span>
                        </InlineEditableCell>
                      )}
                    </td>

                    {/* Коэффициент — inline editable */}
                    <td className="px-5 py-2.5">
                      {isInlineEditing && inlineEdit.field === 'coefficient' ? (
                        <InlineNumberInput
                          value={inlineEdit.value}
                          onChange={(v) => setInlineEdit({ ...inlineEdit, value: v })}
                          onSave={saveInlineEdit}
                          onCancel={cancelInlineEdit}
                        />
                      ) : (
                        <InlineEditableCell onClick={() => startInlineEdit(product.id, 'coefficient', String(product.coefficient))}>
                          <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--apex-text)' }}>
                            ×{product.coefficient}
                          </span>
                        </InlineEditableCell>
                      )}
                    </td>

                    {/* Цена в кристаллах — вычисляется, read-only */}
                    <td className="px-5 py-2.5">
                      <CoinStatic
                        amount={computePriceCrystals(product.cost_byn, product.coefficient, effectiveRate)}
                        size="sm"
                      />
                    </td>

                    {/* Остаток — inline editable только для исчисляемых товаров */}
                    <td className="px-5 py-2.5">
                      {product.category?.is_countable ? (
                        isInlineEditing && inlineEdit.field === 'stock' ? (
                          <InlineNumberInput
                            value={inlineEdit.value}
                            onChange={(v) => setInlineEdit({ ...inlineEdit, value: v })}
                            onSave={saveInlineEdit}
                            onCancel={cancelInlineEdit}
                            min={0}
                          />
                        ) : (
                          <InlineEditableCell onClick={() => startInlineEdit(product.id, 'stock', product.stock != null ? String(product.stock) : '0')}>
                            <span
                              className="text-[13px] font-semibold"
                              style={{
                                color: product.stock === 0
                                  ? 'var(--apex-danger)'
                                  : (product.stock ?? 0) <= 5
                                    ? 'var(--apex-warning-text)'
                                    : 'var(--apex-text)',
                              }}
                            >
                              {product.stock ?? 0}
                            </span>
                          </InlineEditableCell>
                        )
                      ) : (
                        <span className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>
                          ∞
                        </span>
                      )}
                    </td>

                    {/* Статус */}
                    <td className="px-5 py-2.5">
                      {(() => {
                        const isOutOfStock = !!product.category?.is_countable && (product.stock ?? 0) === 0
                        return (
                          <div className="flex items-center gap-2">
                            <ProductStatusDropdown
                              status={getProductStatus(product)}
                              onChange={(s) => setProductStatus(product, s)}
                              disabled={isProductPending || !product.category?.is_active}
                            />
                            {!product.category?.is_active && (
                              <span className="text-[10px] font-medium leading-tight px-1.5 py-0.5 rounded" style={{ background: 'var(--apex-warning-bg)', color: 'var(--apex-warning-text)' }}>
                                Категория<br />неактивна
                              </span>
                            )}
                            {product.category?.is_active && isOutOfStock && !product.is_coming_soon && !product.is_active && (
                              <span
                                className="text-[10px] font-medium leading-tight px-1.5 py-0.5 rounded whitespace-nowrap"
                                style={{ background: 'var(--apex-warning-bg)', color: 'var(--apex-warning-text)' }}
                              >
                                Нет в наличии<br />Измените количество
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>

                    {/* Действия */}
                    <td className="px-5 py-2.5">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--apex-danger)' }}>
                            Удалить?
                          </span>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                            style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setDeletingProductId(null)}
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                            style={{ color: 'var(--apex-text-muted)' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingProduct(product)}
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ color: 'var(--apex-text-muted)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--apex-primary)'
                              e.currentTarget.style.background = 'var(--apex-success-bg)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--apex-text-muted)'
                              e.currentTarget.style.background = 'transparent'
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeletingProductId(product.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ color: 'var(--apex-text-muted)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--apex-danger)'
                              e.currentTarget.style.background = 'var(--apex-error-bg)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--apex-text-muted)'
                              e.currentTarget.style.background = 'transparent'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>}

        <div className="px-5 py-3 text-[12px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
          {filteredProducts.length} из {products.length} товаров
        </div>
      </div>

      {/* Модал создания/редактирования товара — через портал */}
      {(isCreatingProduct || editingProduct) && createPortal(
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          rate={currentRate}
          onSave={handleProductSave}
          onClose={() => {
            setEditingProduct(null)
            setIsCreatingProduct(false)
          }}
          isPending={isProductPending}
        />,
        document.body,
      )}
    </div>
  )
}

// --- Вспомогательные компоненты ---

const catInputStyle: React.CSSProperties = {
  background: 'var(--apex-surface)',
  border: '1px solid var(--apex-border)',
  color: 'var(--apex-text)',
}

function CatEditableCell({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <button
        onClick={onClick}
        className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        style={{ color: 'var(--apex-text-muted)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--apex-primary)'
          e.currentTarget.style.background = 'var(--apex-success-bg)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--apex-text-muted)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <Pencil size={12} />
      </button>
    </div>
  )
}

function InlineEditableCell({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="group/cell flex items-center gap-2 cursor-pointer" onClick={onClick}>
      {children}
      <button
        className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0"
        style={{ color: 'var(--apex-text-muted)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--apex-primary)'
          e.currentTarget.style.background = 'var(--apex-success-bg)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--apex-text-muted)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <Pencil size={12} />
      </button>
    </div>
  )
}

function InlineNumberInput({
  value,
  onChange,
  onSave,
  onCancel,
  min,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  min?: number
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.select()
  }, [])

  return (
    <div
      className="relative z-20 inline-flex items-center gap-0.5 rounded-lg px-1 py-0.5"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onCancel() }}
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-focus)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      }}
    >
      <input
        ref={ref}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel()
        }}
        className="w-14 px-1 py-0.5 rounded text-[13px] outline-none"
        style={{
          background: 'transparent',
          color: 'var(--apex-text)',
        }}
        autoFocus
        min={min}
        placeholder={placeholder}
      />
      <button
        onClick={onSave}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ color: 'var(--apex-success-text)' }}
      >
        <Check size={12} />
      </button>
      <button
        onClick={onCancel}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

function InlineSelect({
  value,
  onChange,
  onSave,
  onCancel,
  options,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  options: { value: string; label: string }[]
}) {
  return (
    <div
      className="relative z-20 inline-flex items-center gap-0.5 rounded-lg px-1 py-0.5"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onCancel() }}
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-focus)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      }}
    >
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        className="px-1 py-0.5 rounded text-[12px] outline-none"
        style={{
          background: 'transparent',
          color: 'var(--apex-text)',
        }}
        autoFocus
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={onSave}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ color: 'var(--apex-success-text)' }}
      >
        <Check size={12} />
      </button>
      <button
        onClick={onCancel}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

function CatInlineEdit({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  placeholder?: string
}) {
  return (
    <div
      className="relative z-20 flex items-center gap-0.5 rounded-lg px-1 py-0.5"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onCancel() }}
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-focus)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel()
        }}
        className="flex-1 min-w-0 px-1 py-0.5 rounded text-[13px] outline-none"
        style={{
          background: 'transparent',
          color: 'var(--apex-text)',
        }}
        autoFocus
        placeholder={placeholder}
      />
      <button
        onClick={onSave}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ color: 'var(--apex-success-text)' }}
      >
        <Check size={12} />
      </button>
      <button
        onClick={onCancel}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

const PRODUCT_STATUS_OPTIONS: { value: ProductStatus; label: string; bg: string; text: string }[] = [
  { value: 'active', label: 'Активен', bg: 'var(--apex-success-bg)', text: 'var(--apex-success-text)' },
  { value: 'coming_soon', label: 'Скоро', bg: 'var(--apex-warning-bg)', text: 'var(--apex-warning-text)' },
  { value: 'inactive', label: 'Неактивен', bg: 'var(--apex-bg)', text: 'var(--apex-text-muted)' },
]

const NUMERIC_OPS: { op: string; label: string; hint: string }[] = [
  { op: '=',  label: '=',  hint: 'равно' },
  { op: '!=', label: '≠',  hint: 'не равно' },
  { op: '>',  label: '>',  hint: 'больше' },
  { op: '>=', label: '≥',  hint: 'не меньше' },
  { op: '<',  label: '<',  hint: 'меньше' },
  { op: '<=', label: '≤',  hint: 'не больше' },
]

// Longest ops first to avoid partial match ('>=', '<=' before '>', '<')
const NUMERIC_OPS_SORTED_DESC = ['>=', '<=', '!=', '>', '<', '=']

function parseOpFromPartial(partial: string): { op: string; numStr: string } | null {
  for (const op of NUMERIC_OPS_SORTED_DESC) {
    if (partial.startsWith(op)) return { op, numStr: partial.slice(op.length) }
  }
  return null
}

function FilterInput({ value, onChange, categories }: { value: string; onChange: (v: string) => void; categories: { name: string; is_active: boolean }[] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const isFocusedRef = useRef(false)
  // Protects cursorPos from being overwritten by onSelect before RAF sets DOM cursor
  const pendingCursorRef = useRef<number | null>(null)
  // Порядок навигации стрелками (в 2-колоночном режиме — сначала левая, потом правая)
  const navOrderRef = useRef<number[]>([])

  const [localValue, setLocalValue] = useState(value)
  const [cursorPos, setCursorPos] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  // Sync from parent when changed externally (skip while focused to avoid debounce loop)
  useEffect(() => {
    if (!isFocusedRef.current && value !== localValue) setLocalValue(value)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced parent update — 200ms
  useEffect(() => {
    const t = setTimeout(() => onChangeRef.current(localValue), 200)
    return () => clearTimeout(t)
  }, [localValue])

  const fieldDefs = useMemo<FieldDef[]>(() => [
    {
      displayKey: 'статус', label: 'Статус', fieldKey: 'status',
      color: 'var(--tag-green-bg)', textColor: 'var(--tag-green-text)', overlayKeyColor: 'var(--tag-green-text)',
      values: [
        { label: 'Активен', insert: 'активный' },
        { label: 'Неактивен', insert: 'неактивный' },
        { label: 'Скоро в продаже', insert: 'скоро' },
      ],
    },
    {
      displayKey: 'категория', label: 'Категория', fieldKey: 'categories',
      color: 'var(--tag-teal-bg)', textColor: 'var(--tag-teal-text)', overlayKeyColor: 'var(--tag-teal-text)',
      multiple: true,
      values: categories.filter(c => c.is_active).map(c => {
        const v = c.name.toLowerCase()
        return { label: c.name, insert: v.includes(' ') ? `"${v}"` : v }
      }),
    },
    {
      displayKey: 'коэф', label: 'Коэффициент', fieldKey: 'coefficient',
      color: 'var(--tag-orange-bg)', textColor: 'var(--tag-orange-text)', overlayKeyColor: 'var(--tag-orange-text)',
      isNumeric: true,
      values: [
        { label: '1', insert: '1' },
        { label: '1.5', insert: '1.5' },
        { label: '2', insert: '2' },
        { label: '3', insert: '3' },
      ],
    },
    {
      displayKey: 'цена', label: 'Цена (кристаллы)', fieldKey: 'price',
      color: 'var(--tag-yellow-bg)', textColor: 'var(--tag-yellow-text)', overlayKeyColor: 'var(--tag-yellow-text)',
      isNumeric: true,
      values: [
        { label: '50', insert: '50' },
        { label: '100', insert: '100' },
        { label: '500', insert: '500' },
        { label: '1000', insert: '1000' },
      ],
    },
    {
      displayKey: 'byn', label: 'Себестоимость BYN', fieldKey: 'costByn',
      color: 'var(--tag-blue-bg)', textColor: 'var(--tag-blue-text)', overlayKeyColor: 'var(--tag-blue-text)',
      isNumeric: true,
      values: [
        { label: '10', insert: '10' },
        { label: '25', insert: '25' },
        { label: '50', insert: '50' },
        { label: '100', insert: '100' },
      ],
    },
    {
      displayKey: 'остаток', label: 'Остаток', fieldKey: 'stock',
      color: 'var(--tag-red-bg)', textColor: 'var(--tag-red-text)', overlayKeyColor: 'var(--tag-red-text)',
      isNumeric: true,
      values: [
        { label: '0', insert: '0' },
        { label: '5', insert: '5' },
        { label: '10', insert: '10' },
      ],
    },
    {
      displayKey: 'картинка', label: 'Картинка', fieldKey: 'hasImage',
      color: 'var(--tag-purple-bg)', textColor: 'var(--tag-purple-text)', overlayKeyColor: 'var(--tag-purple-text)',
      values: [
        { label: 'Есть', insert: 'есть' },
        { label: 'Нет', insert: 'нет' },
        { label: 'Эмодзи', insert: 'эмодзи' },
      ],
    },
  ], [categories])

  type InputContext =
    | { type: 'key'; partial: string; negated: boolean; tokenStart: number }
    | { type: 'value'; fieldKey: string; partial: string; tokenStart: number; keyEnd: number }
    | { type: 'empty' }

  const context = useMemo((): InputContext => {
    const before = localValue.slice(0, cursorPos)

    // Value context: cursor is after "key:" or "-key:"
    const valueMatch = before.match(/(-?)([^\s:]+):(\S*)$/)
    if (valueMatch) {
      const key = valueMatch[2].toLowerCase()
      if (FILTER_KEY_MAP[key]) {
        return {
          type: 'value',
          fieldKey: key,
          partial: valueMatch[3].toLowerCase(),
          tokenStart: before.length - valueMatch[0].length,
          keyEnd: before.length - valueMatch[3].length,
        }
      }
    }

    // Key context: cursor is typing a word without colon
    const keyMatch = before.match(/(-?)(\S+)$/)
    if (keyMatch && !keyMatch[0].includes(':')) {
      return {
        type: 'key',
        partial: keyMatch[2].toLowerCase(),
        negated: keyMatch[1] === '-',
        tokenStart: before.length - keyMatch[0].length,
      }
    }

    return { type: 'empty' }
  }, [localValue, cursorPos])

  type Suggestion =
    | { type: 'key'; field: FieldDef }
    | { type: 'operator'; op: string; label: string; hint: string; field: FieldDef }
    | { type: 'value'; option: { label: string; insert: string }; field: FieldDef }

  const suggestions = useMemo((): Suggestion[] => {
    if (context.type === 'key' || context.type === 'empty') {
      const partial = context.type === 'key' ? context.partial : ''
      return fieldDefs
        .filter(f => !partial || f.displayKey.startsWith(partial) || f.label.toLowerCase().includes(partial))
        .slice(0, 8)
        .map(f => ({ type: 'key' as const, field: f }))
    }

    if (context.type === 'value') {
      const field = fieldDefs.find(f => f.fieldKey === FILTER_KEY_MAP[context.fieldKey])
      if (!field) return []

      if (field.isNumeric) {
        const opParsed = parseOpFromPartial(context.partial)
        if (!opParsed) {
          // Шаг 1 для числовых: выбор оператора
          return NUMERIC_OPS.map(({ op, label, hint }) => ({
            type: 'operator' as const, op, label, hint, field,
          }))
        }
        // Шаг 2: числовые значения для выбранного оператора
        const numStr = opParsed.numStr
        return field.values
          .filter(v => !numStr || v.insert.startsWith(numStr))
          .map(v => ({
            type: 'value' as const,
            option: { label: v.label, insert: opParsed.op + v.insert },
            field,
          }))
      }

      const partial = context.partial
      return field.values
        .filter(v => !partial || v.label.toLowerCase().includes(partial) || v.insert.startsWith(partial))
        .slice(0, 8)
        .map(v => ({ type: 'value' as const, option: v, field }))
    }

    return []
  }, [context, fieldDefs])

  useEffect(() => { setHighlightIdx(0) }, [suggestions.length, context.type])

  const activeFieldDef = context.type === 'value'
    ? fieldDefs.find(f => f.fieldKey === FILTER_KEY_MAP[context.fieldKey])
    : null

  // Оператор, выбранный на шаге 1 числового поля (null если не в числовой value-фазе)
  const currentNumericOp = context.type === 'value' && activeFieldDef?.isNumeric
    ? (parseOpFromPartial(context.partial)?.op ?? null)
    : null

  function applySuggestion(s: Suggestion) {
    if (s.type === 'key') {
      const negated = context.type === 'key' && context.negated
      const keyText = `${negated ? '-' : ''}${s.field.displayKey}:`
      const start = context.type !== 'empty' ? context.tokenStart : cursorPos
      const before = localValue.slice(0, start)
      const after = localValue.slice(cursorPos)
      const newVal = before + keyText + after
      const newCursor = before.length + keyText.length
      pendingCursorRef.current = newCursor
      setLocalValue(newVal)
      setCursorPos(newCursor)
      setShowDropdown(true)
      requestAnimationFrame(() => {
        pendingCursorRef.current = null
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newCursor, newCursor)
        }
      })
    } else if (s.type === 'operator') {
      if (context.type !== 'value') return
      const before = localValue.slice(0, context.keyEnd)
      const after = localValue.slice(cursorPos).trimStart()
      const newVal = before + s.op + after
      const newCursor = before.length + s.op.length
      pendingCursorRef.current = newCursor
      setLocalValue(newVal)
      setCursorPos(newCursor)
      setShowDropdown(true)
      requestAnimationFrame(() => {
        pendingCursorRef.current = null
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newCursor, newCursor)
        }
      })
    } else {
      if (context.type !== 'value') return
      const insertText = s.option.insert
      const before = localValue.slice(0, context.keyEnd)
      const after = localValue.slice(cursorPos).trimStart()
      const newVal = before + insertText + ' ' + after
      const newCursor = before.length + insertText.length + 1
      pendingCursorRef.current = newCursor
      setLocalValue(newVal)
      setCursorPos(newCursor)
      setShowDropdown(false)
      requestAnimationFrame(() => {
        pendingCursorRef.current = null
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newCursor, newCursor)
        }
      })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setShowDropdown(true) }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const order = navOrderRef.current
      const pos = order.indexOf(highlightIdx)
      setHighlightIdx(order[(pos + 1) % order.length])
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const order = navOrderRef.current
      const pos = order.indexOf(highlightIdx)
      setHighlightIdx(order[(pos - 1 + order.length) % order.length])
    }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (suggestions[highlightIdx]) applySuggestion(suggestions[highlightIdx]) }
    else if (e.key === 'Escape') {
      e.preventDefault()
      if (context.type === 'value') {
        if (currentNumericOp) {
          // Числовое поле, оператор выбран — назад к выбору оператора
          const newVal = localValue.slice(0, context.keyEnd) + localValue.slice(cursorPos).trimStart()
          const newCursor = context.keyEnd
          setLocalValue(newVal)
          setCursorPos(newCursor)
          setShowDropdown(true)
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.focus()
              inputRef.current.setSelectionRange(newCursor, newCursor)
            }
          })
        } else {
          // Назад к выбору ключа — убираем весь токен
          const newVal = localValue.slice(0, context.tokenStart) + localValue.slice(cursorPos).trimStart()
          const newCursor = context.tokenStart
          setLocalValue(newVal)
          setCursorPos(newCursor)
          setShowDropdown(true)
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.focus()
              inputRef.current.setSelectionRange(newCursor, newCursor)
            }
          })
        }
      } else {
        setShowDropdown(false)
      }
    }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const updateDropdownPos = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }

  useEffect(() => {
    if (!showDropdown) return
    updateDropdownPos()
    window.addEventListener('scroll', updateDropdownPos, true)
    window.addEventListener('resize', updateDropdownPos)
    return () => {
      window.removeEventListener('scroll', updateDropdownPos, true)
      window.removeEventListener('resize', updateDropdownPos)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDropdown, suggestions.length])

  // Token highlighting overlay
  const tokens = useMemo(() => parseFilterTokens(localValue), [localValue])

  const highlightContent = useMemo((): ReactNode[] | null => {
    if (!localValue || tokens.length === 0) return null
    const parts: ReactNode[] = []
    let lastIdx = 0

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.start > lastIdx) {
        parts.push(
          <span key={`gap-${i}`} style={{ color: 'var(--apex-text)' }}>
            {localValue.slice(lastIdx, token.start)}
          </span>
        )
      }
      const field = fieldDefs.find(f => f.fieldKey === FILTER_KEY_MAP[token.key])
      const colonIdx = token.raw.indexOf(':')
      const rawKey = token.raw.slice(0, colonIdx + 1)
      const rawVal = token.raw.slice(colonIdx + 1)
      const keyColor = token.negated ? 'var(--apex-danger)' : (field?.overlayKeyColor ?? 'var(--apex-primary)')
      const valColor = token.negated ? 'var(--apex-danger)' : 'var(--apex-text-muted)'

      parts.push(
        <span key={`tok-${i}`}>
          <span style={{
            color: token.negated ? 'var(--apex-danger)' : (field?.textColor ?? 'white'),
            background: token.negated ? 'var(--apex-error-bg)' : (field?.color ?? 'var(--apex-primary)'),
            borderRadius: '3px',
          }}>{rawKey}</span>
          <span style={{ color: valColor }}>{rawVal}</span>
        </span>
      )
      lastIdx = token.start + token.raw.length
    }

    if (lastIdx < localValue.length) {
      parts.push(<span key="tail" style={{ color: 'var(--apex-text)' }}>{localValue.slice(lastIdx)}</span>)
    }
    return parts
  }, [localValue, tokens, fieldDefs])

  const tokenCount = tokens.length
  const hasDropdown = showDropdown && suggestions.length > 0

  // Если под дропдауном мало места — показываем в 2 столбца
  const useTwoCols = (() => {
    if (!hasDropdown || suggestions.length < 4) return false
    const ROW_H = 32
    const headerH = context.type === 'value' ? 44 : 28
    const hintH = context.type === 'value' && activeFieldDef?.isNumeric ? 36 : 0
    const oneColH = headerH + suggestions.length * ROW_H + hintH
    const available = typeof window !== 'undefined' ? window.innerHeight - dropdownPos.top - 8 : 9999
    return oneColH > available
  })()

  // Порядок навигации: в 2-колонках — сначала вся левая колонка, потом правая
  navOrderRef.current = (() => {
    const N = suggestions.length
    if (!useTwoCols) return Array.from({ length: N }, (_, i) => i)
    const rowCount = Math.ceil(N / 2)
    const order: number[] = []
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < rowCount; row++) {
        const idx = row * 2 + col
        if (idx < N) order.push(idx)
      }
    }
    return order
  })()

  return (
    <div ref={containerRef} className="relative">
      {/* Input wrapper */}
      <div
        className="flex items-center rounded-lg"
        style={{
          background: 'var(--apex-bg)',
          border: hasDropdown || localValue ? '1px solid var(--apex-primary)' : '1px solid var(--apex-border)',
          transition: 'border-color 0.15s',
        }}
      >
        <Search size={14} className="ml-2.5 shrink-0" style={{ color: 'var(--apex-text-muted)' }} />

        {/* Highlight overlay + real input */}
        <div className="relative flex-1 min-w-0 overflow-hidden">
          {/* Colored token spans — sits behind the cursor */}
          {highlightContent && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center pl-2 pr-2 text-[12px] whitespace-pre"
            >
              {highlightContent}
            </div>
          )}

          {/* Real input — text transparent when overlay is active so cursor shows through */}
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value)
              setCursorPos(e.target.selectionStart ?? e.target.value.length)
              setShowDropdown(true)
              setHighlightIdx(0)
            }}
            onSelect={() => {
              // Skip if applySuggestion RAF hasn't fired yet — it will set the correct position
              if (pendingCursorRef.current !== null) return
              if (inputRef.current) setCursorPos(inputRef.current.selectionStart ?? localValue.length)
            }}
            onFocus={() => { isFocusedRef.current = true; setShowDropdown(true) }}
            onBlur={() => { isFocusedRef.current = false; setTimeout(() => setShowDropdown(false), 150) }}
            onKeyDown={handleKeyDown}
            placeholder="статус:активный  коэф:>= 1.5  категория:еда  картинка:нет"
            spellCheck={false}
            autoComplete="off"
            className="relative w-full bg-transparent pl-2 pr-2 py-1.5 text-[12px] outline-none placeholder:opacity-40"
            style={{
              color: highlightContent ? 'transparent' : 'var(--apex-text)',
              caretColor: 'var(--apex-text)',
            }}
          />
        </div>

        {/* Token counter + clear */}
        {tokenCount > 0 && (
          <div className="flex items-center gap-1 pr-2 shrink-0">
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--apex-text-muted)' }}>{tokenCount}</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                setLocalValue('')
                onChangeRef.current('')
                setCursorPos(0)
                setShowDropdown(true)
                inputRef.current?.focus()
              }}
              style={{ color: 'var(--apex-text-muted)' }}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Dropdown — через портал, чтобы выходить за рамки overflow:hidden контейнера */}
      {hasDropdown && createPortal(
        <div
          className="fixed z-[200] rounded-xl overflow-hidden"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            minWidth: '220px',
            maxWidth: '480px',
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
          }}
        >
          {/* Value phase header with back button */}
          {context.type === 'value' && activeFieldDef && (
            <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--apex-border)' }}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (context.type !== 'value') return
                  if (currentNumericOp) {
                    // Числовое поле с оператором — назад к операторам
                    const newVal = localValue.slice(0, context.keyEnd) + localValue.slice(cursorPos).trimStart()
                    const newCursor = context.keyEnd
                    setLocalValue(newVal); setCursorPos(newCursor); setShowDropdown(true)
                    requestAnimationFrame(() => { if (inputRef.current) { inputRef.current.focus(); inputRef.current.setSelectionRange(newCursor, newCursor) } })
                  } else {
                    // Назад к ключам
                    const newVal = localValue.slice(0, context.tokenStart) + localValue.slice(cursorPos).trimStart()
                    const newCursor = context.tokenStart
                    setLocalValue(newVal); setCursorPos(newCursor); setShowDropdown(true)
                    requestAnimationFrame(() => { if (inputRef.current) { inputRef.current.focus(); inputRef.current.setSelectionRange(newCursor, newCursor) } })
                  }
                }}
                className="w-5 h-5 flex items-center justify-center rounded"
                style={{ color: 'var(--apex-text-muted)' }}
              >
                <ChevronRight size={12} className="rotate-180" />
              </button>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: activeFieldDef.color, color: activeFieldDef.textColor }}
              >
                {activeFieldDef.label}
              </span>
              {currentNumericOp ? (
                <>
                  <span
                    className="text-[12px] font-bold font-mono px-1.5 py-0.5 rounded"
                    style={{ background: activeFieldDef.color, color: activeFieldDef.textColor }}
                  >
                    {currentNumericOp}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>— введите или выберите число</span>
                </>
              ) : activeFieldDef.isNumeric ? (
                <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>— выберите оператор</span>
              ) : (
                <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>— выберите значение</span>
              )}
            </div>
          )}

          {/* Suggestions list */}
          <div className="py-1">
            {context.type !== 'value' && (
              <p className="text-[10px] font-semibold uppercase tracking-wide px-3 pt-2 pb-1" style={{ color: 'var(--apex-text-muted)' }}>
                Фильтр по
              </p>
            )}
            <div className={useTwoCols ? 'grid grid-cols-2' : undefined}>
              {suggestions.map((s, i) => {
                const isHighlighted = highlightIdx === i
                if (s.type === 'key') {
                  return (
                    <button
                      key={s.field.displayKey}
                      onMouseDown={(e) => { e.preventDefault(); applySuggestion(s) }}
                      onMouseEnter={() => setHighlightIdx(i)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
                      style={{ background: isHighlighted ? 'var(--apex-bg)' : 'transparent' }}
                    >
                      <span
                        className="px-1.5 py-0.5 rounded text-[11px] font-semibold shrink-0 font-mono"
                        style={{ background: s.field.color, color: s.field.textColor }}
                      >
                        {s.field.displayKey}:
                      </span>
                      <span className="text-[12px] truncate" style={{ color: 'var(--apex-text)' }}>
                        {s.field.label}
                      </span>
                    </button>
                  )
                } else if (s.type === 'operator') {
                  return (
                    <button
                      key={s.op}
                      onMouseDown={(e) => { e.preventDefault(); applySuggestion(s) }}
                      onMouseEnter={() => setHighlightIdx(i)}
                      className="w-full flex items-center gap-3 px-3 py-1.5 text-left"
                      style={{ background: isHighlighted ? 'var(--apex-bg)' : 'transparent' }}
                    >
                      <span
                        className="text-[13px] font-bold font-mono w-6 text-center shrink-0"
                        style={{ color: isHighlighted ? s.field.overlayKeyColor : 'var(--apex-text)' }}
                      >
                        {s.label}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>{s.hint}</span>
                    </button>
                  )
                } else {
                  return (
                    <button
                      key={s.option.insert}
                      onMouseDown={(e) => { e.preventDefault(); applySuggestion(s) }}
                      onMouseEnter={() => setHighlightIdx(i)}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left"
                      style={{
                        background: isHighlighted ? s.field.color : 'transparent',
                        color: isHighlighted ? s.field.textColor : 'var(--apex-text)',
                      }}
                    >
                      <span className="text-[12px] font-medium truncate">{s.option.label}</span>
                    </button>
                  )
                }
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function ProductStatusDropdown({
  status,
  onChange,
  disabled,
}: {
  status: ProductStatus
  onChange: (s: ProductStatus) => void
  disabled: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const current = PRODUCT_STATUS_OPTIONS.find((o) => o.value === status)!

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, left: rect.left })
    }
  }, [isOpen])

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md transition-opacity"
        style={{
          background: current.bg,
          color: current.text,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {current.label}
        {!disabled && <ChevronDown size={11} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[140px] rounded-xl py-1.5 shadow-lg animate-scale-in"
          style={{
            top: pos.top,
            left: pos.left,
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
          }}
        >
          {PRODUCT_STATUS_OPTIONS.map((o) => {
            const isCurrent = o.value === status
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setIsOpen(false) }}
                className="w-full text-left px-4 py-2 text-[12px] font-medium transition-colors flex items-center gap-2.5"
                style={{
                  color: isCurrent ? o.text : 'var(--apex-text)',
                  background: isCurrent ? o.bg : 'transparent',
                  cursor: isCurrent ? 'default' : 'pointer',
                }}
                onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'var(--apex-bg)' }}
                onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: o.text }} />
                {o.label}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: () => void
  disabled: boolean
  label: string
}) {
  return (
    <label className="inline-flex items-center gap-2.5" style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
        style={{ background: checked ? 'var(--apex-primary)' : 'var(--apex-border)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </button>
      <span
        className="text-[12px] font-medium select-none"
        style={{ color: checked ? 'var(--apex-success-text)' : 'var(--apex-text-muted)' }}
      >
        {label}
      </span>
    </label>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
      style={{
        background: active ? 'var(--apex-primary)' : 'transparent',
        color: active ? 'white' : 'var(--apex-text-muted)',
      }}
    >
      {children}
    </button>
  )
}

function CategoryFilters({
  categories,
  products,
  categoryFilter,
  onFilterChange,
}: {
  categories: ShopCategory[]
  products: ShopProductWithCategory[]
  categoryFilter: string
  onFilterChange: (slug: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [visibleCount, setVisibleCount] = useState(categories.length)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function measure() {
      const container = containerRef.current
      const measurer = measureRef.current
      if (!container || !measurer) return

      const maxWidth = container.offsetWidth
      const children = Array.from(measurer.children) as HTMLElement[]
      if (children.length === 0) return

      const gap = 6
      const overflowBtnWidth = 50
      let usedWidth = children[0].offsetWidth + gap // "Все" всегда видна
      let fits = 0

      for (let i = 1; i < children.length; i++) {
        const next = usedWidth + children[i].offsetWidth + gap
        // Проверяем: поместится ли этот пилл + кнопка +N (если есть ещё после него)
        const hasMore = i < children.length - 1
        if (next + (hasMore ? overflowBtnWidth : 0) > maxWidth) break
        usedWidth = next
        fits++
      }

      setVisibleCount(fits)
    }

    measure()
    const obs = new ResizeObserver(measure)
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [categories, products])

  useEffect(() => {
    if (!showAll) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowAll(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAll])

  const visible = categories.slice(0, visibleCount)
  const overflow = categories.slice(visibleCount)
  const hasOverflow = overflow.length > 0
  const overflowActive = overflow.some((c) => c.slug === categoryFilter)

  return (
    <div ref={containerRef} className="flex-1 min-w-0 relative">
      {/* Невидимый измеритель */}
      <div ref={measureRef} className="flex gap-1.5 absolute invisible pointer-events-none whitespace-nowrap top-0 left-0">
        <FilterPill active={false} onClick={() => {}}>Все ({products.length})</FilterPill>
        {categories.map((cat) => {
          const count = products.filter((p) => p.category?.slug === cat.slug).length
          return (
            <FilterPill key={cat.id} active={false} onClick={() => {}}>{cat.name} ({count})</FilterPill>
          )
        })}
      </div>

      {/* Видимые пиллы */}
      <div className="flex items-center gap-1.5">
        <FilterPill active={categoryFilter === 'all'} onClick={() => onFilterChange('all')}>
          Все ({products.length})
        </FilterPill>
        {visible.map((cat) => {
          const count = products.filter((p) => p.category?.slug === cat.slug).length
          return (
            <FilterPill key={cat.id} active={categoryFilter === cat.slug} onClick={() => onFilterChange(cat.slug)}>
              {cat.name} ({count})
            </FilterPill>
          )
        })}
        {hasOverflow && (
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors"
              style={{
                background: overflowActive ? 'var(--apex-primary)' : 'transparent',
                color: overflowActive ? 'white' : 'var(--apex-text-muted)',
              }}
            >
              +{overflow.length}
              <ChevronDown size={12} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
            </button>
            {showAll && (
              <div
                className="absolute top-full left-0 mt-1.5 z-50 min-w-[160px] rounded-xl py-1.5 shadow-lg animate-scale-in"
                style={{
                  background: 'var(--apex-surface)',
                  border: '1px solid var(--apex-border)',
                }}
              >
                {overflow.map((cat) => {
                  const count = products.filter((p) => p.category?.slug === cat.slug).length
                  const isActive = categoryFilter === cat.slug
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { onFilterChange(cat.slug); setShowAll(false) }}
                      className="w-full text-left px-4 py-2 text-[12px] font-medium transition-colors flex items-center justify-between"
                      style={{
                        color: isActive ? 'var(--apex-primary)' : 'var(--apex-text)',
                        background: isActive ? 'var(--apex-success-bg)' : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--apex-bg)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? 'var(--apex-success-bg)' : 'transparent' }}
                    >
                      <span>{cat.name} ({count})</span>
                      {isActive && <Check size={14} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SlugHelp({ size = 14 }: { size?: number }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!show) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [show])

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="flex items-center justify-center cursor-help"
      >
        <HelpCircle size={size} style={{ color: 'var(--apex-text-muted)' }} />
      </button>
      {show && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-56 rounded-xl px-4 py-3 shadow-lg text-[11px] leading-relaxed"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
            color: 'var(--apex-text-secondary)',
          }}
        >
          <p className="font-semibold mb-1" style={{ color: 'var(--apex-text)' }}>Требования к slug</p>
          <ul className="space-y-0.5 list-disc pl-3">
            <li>Только строчные латинские буквы, цифры и нижние подчёркивания</li>
            <li>Начинается с буквы</li>
            <li>Уникальное значение</li>
          </ul>
        </div>
      )}
    </span>
  )
}

const TYPE_OPTIONS = [
  { value: true, label: 'Физический', bg: 'var(--apex-info-bg)', text: 'var(--apex-info-text)' },
  { value: false, label: 'Цифровой', bg: 'var(--apex-tag-purple-bg)', text: 'var(--apex-tag-purple-text)' },
]

function CatTypeDropdown({
  catId,
  isPhysical,
  isOpen,
  onToggle,
  onSelect,
}: {
  catId: string
  isPhysical: boolean
  isOpen: boolean
  onToggle: () => void
  onSelect: (value: boolean) => void
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const current = TYPE_OPTIONS.find((o) => o.value === isPhysical)!

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) onToggle()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onToggle])

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, left: rect.left })
    }
  }, [isOpen])

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-opacity hover:opacity-80"
        style={{ background: current.bg, color: current.text }}
      >
        {current.label}
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[140px] rounded-xl py-1.5 shadow-lg animate-scale-in"
          style={{
            top: pos.top,
            left: pos.left,
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
          }}
        >
          {TYPE_OPTIONS.map((o) => {
            const isCurrent = o.value === isPhysical
            return (
              <button
                key={String(o.value)}
                onClick={() => onSelect(o.value)}
                className="w-full text-left px-4 py-2 text-[12px] font-medium transition-colors flex items-center gap-2.5"
                style={{
                  color: isCurrent ? o.text : 'var(--apex-text)',
                  background: isCurrent ? o.bg : 'transparent',
                  cursor: isCurrent ? 'default' : 'pointer',
                }}
                onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'var(--apex-bg)' }}
                onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: o.text }}
                />
                {o.label}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
