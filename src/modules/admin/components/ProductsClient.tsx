'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, ChevronDown, ChevronRight } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'
import {
  createCategory,
  updateCategory,
  createProduct,
  updateProduct,
  uploadProductImage,
  deleteProductImage,
} from '@/modules/shop/index.client'

import { ProductFormModal } from './ProductFormModal'
import type { ProductFormData } from '../types'
import type { ShopProductWithCategory, ShopCategory } from '@/modules/shop/index.client'

interface ProductsClientProps {
  products: ShopProductWithCategory[]
  categories: ShopCategory[]
}

export function ProductsClient({ products: initialProducts, categories: initialCategories }: ProductsClientProps) {
  const [products, setProducts] = useState(initialProducts)
  const [categories, setCategories] = useState(initialCategories)
  const [isCatPending, startCatTransition] = useTransition()
  const [isProductPending, startProductTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  // Товары — фильтр и модал
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editingProduct, setEditingProduct] = useState<ShopProductWithCategory | null>(null)
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)

  // Категории — секция
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', slug: '', description: '', is_physical: false, sort_order: 0 })
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editCatField, setEditCatField] = useState<'name' | 'slug' | 'description' | null>(null)
  const [editCatValue, setEditCatValue] = useState('')

  const filteredProducts = categoryFilter === 'all'
    ? products
    : products.filter((p) => p.category?.slug === categoryFilter)

  function showNotification(msg: string) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  // --- Категории ---

  function startCatEdit(cat: ShopCategory, field: 'name' | 'slug' | 'description') {
    setEditingCatId(cat.id)
    setEditCatField(field)
    setEditCatValue(field === 'description' ? (cat.description ?? '') : cat[field])
    setError(null)
  }

  function cancelCatEdit() {
    setEditingCatId(null)
    setEditCatField(null)
    setEditCatValue('')
  }

  function saveCatEdit(id: string) {
    if (!editCatField) return
    const value = editCatValue.trim()
    if (editCatField !== 'description' && !value) {
      setError(`${editCatField === 'name' ? 'Название' : 'Slug'} обязателен`)
      return
    }
    submitCatUpdate(id, { [editCatField]: editCatField === 'description' ? (value || null) : value })
  }

  function toggleCatActive(id: string, current: boolean) {
    submitCatUpdate(id, { is_active: !current })
  }

  function submitCatUpdate(id: string, fields: Record<string, unknown>) {
    const prev = categories
    setCategories((cats) => cats.map((c) => (c.id === id ? { ...c, ...fields } : c)))
    cancelCatEdit()

    startCatTransition(async () => {
      const result = await updateCategory({ id, ...fields })
      if (!result.success) {
        setCategories(prev)
        setError(result.error)
      }
    })
  }

  function handleCreateCategory() {
    if (!newCat.name.trim() || !newCat.slug.trim()) {
      setError('Название и slug обязательны')
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
            created_at: new Date().toISOString(),
          },
        ])
        setNewCat({ name: '', slug: '', description: '', is_physical: false, sort_order: 0 })
        setIsCreatingCategory(false)
        showNotification('Категория создана')
      }
    })
  }

  // --- Товары ---

  function toggleProductActive(id: string, current: boolean) {
    const prev = products
    setProducts((items) => items.map((p) => (p.id === id ? { ...p, is_active: !current } : p)))

    startProductTransition(async () => {
      const result = await updateProduct({ id, is_active: !current })
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
        const uploadResult = await uploadProductImage(fd)
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
        ? { name: cat.name, slug: cat.slug, is_physical: cat.is_physical, is_active: cat.is_active }
        : { name: '', slug: '', is_physical: false, is_active: true }

      // Optimistic update
      const prev = products
      if (editingProduct) {
        setProducts((list) =>
          list.map((p) =>
            p.id === editingProduct.id ? { ...p, ...payload, category: categoryData } : p
          )
        )
      } else {
        const tempId = `temp-${Date.now()}`
        setProducts((list) => [
          {
            id: tempId,
            ...payload,
            is_active: true,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            category: categoryData,
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
      {/* Toast */}
      {notification && (
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
        </div>
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

      {/* === КАТЕГОРИИ === */}
      <div
        className="rounded-2xl overflow-hidden"
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
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newCat.name}
                    onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                    placeholder="Название"
                    className="px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={catInputStyle}
                  />
                  <input
                    type="text"
                    value={newCat.slug}
                    onChange={(e) => setNewCat({ ...newCat, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="slug"
                    className="px-3 py-2 rounded-lg text-[13px] outline-none font-mono"
                    style={catInputStyle}
                  />
                  <input
                    type="text"
                    value={newCat.description}
                    onChange={(e) => setNewCat({ ...newCat, description: e.target.value })}
                    placeholder="Описание"
                    className="px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={catInputStyle}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--apex-text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={newCat.is_physical}
                      onChange={(e) => setNewCat({ ...newCat, is_physical: e.target.checked })}
                      className="rounded"
                    />
                    Физический товар
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>Порядок:</span>
                    <input
                      type="number"
                      value={newCat.sort_order}
                      onChange={(e) => setNewCat({ ...newCat, sort_order: parseInt(e.target.value, 10) || 0 })}
                      className="w-16 px-2 py-1 rounded-lg text-[13px] outline-none"
                      style={catInputStyle}
                      min={0}
                    />
                  </div>
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
            <table className="w-full">
              <thead>
                <tr style={{ borderTop: '1px solid var(--apex-border)', borderBottom: '1px solid var(--apex-border)' }}>
                  {['Название', 'Slug', 'Описание', 'Тип', 'Порядок', 'Статус'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[12px] font-semibold px-5 py-2.5"
                      style={{ color: 'var(--apex-text-secondary)' }}
                    >
                      {h}
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
                            onChange={setEditCatValue}
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
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                          style={{
                            background: cat.is_physical ? 'var(--apex-info-bg)' : 'var(--apex-tag-purple-bg)',
                            color: cat.is_physical ? 'var(--apex-info-text)' : 'var(--apex-tag-purple-text)',
                          }}
                        >
                          {cat.is_physical ? 'Физический' : 'Цифровой'}
                        </span>
                      </td>

                      {/* Порядок */}
                      <td className="px-5 py-2.5">
                        <span className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>
                          {cat.sort_order}
                        </span>
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
          </>
        )}
      </div>

      {/* === ТОВАРЫ === */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        {/* Заголовок товаров */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--apex-border)' }}>
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-semibold" style={{ color: 'var(--apex-text)' }}>
              Товары
            </span>
            <div className="flex gap-1.5">
              <FilterPill active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
                Все ({products.length})
              </FilterPill>
              {categories.map((cat) => {
                const count = products.filter((p) => p.category?.slug === cat.slug).length
                return (
                  <FilterPill key={cat.id} active={categoryFilter === cat.slug} onClick={() => setCategoryFilter(cat.slug)}>
                    {cat.name} ({count})
                  </FilterPill>
                )
              })}
            </div>
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

        {/* Таблица товаров */}
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--apex-border)' }}>
              {['', 'Название', 'Категория', 'Цена', 'Остаток', 'Статус', ''].map((h, i) => (
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
                <td colSpan={7} className="text-center py-12">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
                    Нет товаров
                  </p>
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id} className="group" style={{ borderBottom: '1px solid var(--apex-border)' }}>
                  {/* Изображение */}
                  <td className="px-5 py-2.5 w-12">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl overflow-hidden"
                      style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
                    >
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        product.emoji ?? '📦'
                      )}
                    </div>
                  </td>

                  {/* Название */}
                  <td className="px-5 py-2.5">
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                      {product.name}
                    </span>
                    {product.description && (
                      <p className="text-[11px] mt-0.5 truncate max-w-[250px]" style={{ color: 'var(--apex-text-muted)' }}>
                        {product.description}
                      </p>
                    )}
                  </td>

                  {/* Категория */}
                  <td className="px-5 py-2.5">
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                      style={{ background: 'var(--apex-tag-teal-bg)', color: 'var(--apex-tag-teal-text)' }}
                    >
                      {product.category?.name ?? '—'}
                    </span>
                  </td>

                  {/* Цена */}
                  <td className="px-5 py-2.5">
                    <CoinStatic amount={product.price} size="sm" />
                  </td>

                  {/* Остаток */}
                  <td className="px-5 py-2.5">
                    {product.stock != null ? (
                      <span
                        className="text-[13px] font-semibold"
                        style={{
                          color: product.stock === 0
                            ? 'var(--apex-danger)'
                            : product.stock <= 5
                              ? 'var(--apex-warning-text)'
                              : 'var(--apex-text)',
                        }}
                      >
                        {product.stock}
                      </span>
                    ) : (
                      <span className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>
                        ∞
                      </span>
                    )}
                  </td>

                  {/* Статус */}
                  <td className="px-5 py-2.5">
                    <ToggleSwitch
                      checked={product.is_active}
                      onChange={() => toggleProductActive(product.id, product.is_active)}
                      disabled={isProductPending}
                      label={product.is_active ? 'Активен' : 'Неактивен'}
                    />
                  </td>

                  {/* Действия */}
                  <td className="px-5 py-2.5">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="px-5 py-3 text-[12px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
          {filteredProducts.length} из {products.length} товаров
        </div>
      </div>

      {/* Модал создания/редактирования товара */}
      {(isCreatingProduct || editingProduct) && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          onSave={handleProductSave}
          onClose={() => {
            setEditingProduct(null)
            setIsCreatingProduct(false)
          }}
          isPending={isProductPending}
        />
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
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave()
        if (e.key === 'Escape') onCancel()
      }}
      className="w-full px-2.5 py-1.5 rounded-lg text-[13px] outline-none"
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-focus)',
        color: 'var(--apex-text)',
        boxShadow: '0 0 0 1px var(--apex-focus)',
      }}
      autoFocus
      placeholder={placeholder}
    />
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
    <label className="inline-flex items-center gap-2.5 cursor-pointer">
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
