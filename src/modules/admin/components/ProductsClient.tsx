'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight, Check, X, HelpCircle } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'
import {
  createCategory,
  updateCategory,
  createProduct,
  updateProduct,
  deleteProduct,
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

  // Товары — фильтр, поиск и модал
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingProduct, setEditingProduct] = useState<ShopProductWithCategory | null>(null)
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)

  // Inline-редактирование товаров
  const [inlineEdit, setInlineEdit] = useState<{
    productId: string
    field: 'category_id' | 'price' | 'stock'
    value: string
  } | null>(null)

  // Категории — секция
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', slug: '', description: '', is_physical: true })
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editCatField, setEditCatField] = useState<'name' | 'slug' | 'description' | 'is_physical' | null>(null)
  const [editCatValue, setEditCatValue] = useState('')

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
        setNewCat({ name: '', slug: '', description: '', is_physical: false })
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

  function startInlineEdit(productId: string, field: 'category_id' | 'price' | 'stock', currentValue: string) {
    setInlineEdit({ productId, field, value: currentValue })
  }

  function cancelInlineEdit() {
    setInlineEdit(null)
  }

  function saveInlineEdit() {
    if (!inlineEdit) return
    const { productId, field, value } = inlineEdit

    let updatePayload: Record<string, unknown> = {}

    if (field === 'price') {
      const num = parseInt(value, 10)
      if (isNaN(num) || num <= 0) {
        setError('Цена должна быть больше 0')
        return
      }
      updatePayload = { price: num }
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
          updated.category = { name: cat.name, slug: cat.slug, is_physical: cat.is_physical, is_active: cat.is_active }
          updated.category_id = cat.id
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
                  <label className="flex items-center gap-2 text-[13px] px-3 py-2" style={{ color: 'var(--apex-text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={newCat.is_physical}
                      onChange={(e) => setNewCat({ ...newCat, is_physical: e.target.checked })}
                      className="rounded"
                    />
                    Физический товар
                  </label>
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
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr style={{ borderTop: '1px solid var(--apex-border)', borderBottom: '1px solid var(--apex-border)' }}>
                  {['Название', 'Slug', 'Описание', 'Тип', 'Статус'].map((h) => (
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
                              submitCatUpdate(cat.id, { is_physical: val })
                            }
                          }}
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

        {/* Таблица товаров */}
        <table className="w-full" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '60px' }} />
            <col />
            <col style={{ width: '150px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '200px' }} />
            <col style={{ width: '90px' }} />
          </colgroup>
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
                        <p className="text-[11px] mt-0.5 truncate max-w-[250px]" style={{ color: 'var(--apex-text-muted)' }}>
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
                            style={{ background: 'var(--apex-tag-teal-bg)', color: 'var(--apex-tag-teal-text)' }}
                          >
                            {product.category?.name ?? '—'}
                          </span>
                        </InlineEditableCell>
                      )}
                    </td>

                    {/* Цена — inline editable */}
                    <td className="px-5 py-2.5">
                      {isInlineEditing && inlineEdit.field === 'price' ? (
                        <InlineNumberInput
                          value={inlineEdit.value}
                          onChange={(v) => setInlineEdit({ ...inlineEdit, value: v })}
                          onSave={saveInlineEdit}
                          onCancel={cancelInlineEdit}
                          min={1}
                        />
                      ) : (
                        <InlineEditableCell onClick={() => startInlineEdit(product.id, 'price', String(product.price))}>
                          <CoinStatic amount={product.price} size="sm" />
                        </InlineEditableCell>
                      )}
                    </td>

                    {/* Остаток — inline editable только для физических товаров */}
                    <td className="px-5 py-2.5">
                      {product.category?.is_physical ? (
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
                      <div className="flex items-center gap-2">
                        <ToggleSwitch
                          checked={product.is_active}
                          onChange={() => toggleProductActive(product.id, product.is_active)}
                          disabled={isProductPending || !product.category?.is_active}
                          label={product.is_active ? 'Активен' : 'Неактивен'}
                        />
                        {!product.category?.is_active && (
                          <span className="text-[10px] font-medium leading-tight px-1.5 py-0.5 rounded" style={{ background: 'var(--apex-warning-bg)', color: 'var(--apex-warning-text)' }}>
                            Категория<br />неактивна
                          </span>
                        )}
                      </div>
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

        <div className="px-5 py-3 text-[12px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
          {filteredProducts.length} из {products.length} товаров
        </div>
      </div>

      {/* Модал создания/редактирования товара — через портал */}
      {(isCreatingProduct || editingProduct) && createPortal(
        <ProductFormModal
          product={editingProduct}
          categories={categories}
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
      className="flex items-center gap-1"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onCancel() }}
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
        className="w-20 px-2 py-1 rounded-lg text-[13px] outline-none"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-focus)',
          color: 'var(--apex-text)',
          boxShadow: '0 0 0 1px var(--apex-focus)',
        }}
        autoFocus
        min={min}
        placeholder={placeholder}
      />
      <button
        onClick={onSave}
        className="w-6 h-6 rounded-full flex items-center justify-center"
        style={{ color: 'var(--apex-success-text)' }}
      >
        <Check size={14} />
      </button>
      <button
        onClick={onCancel}
        className="w-6 h-6 rounded-full flex items-center justify-center"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        <X size={14} />
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
      className="flex items-center gap-1"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onCancel() }}
    >
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        className="px-2 py-1 rounded-lg text-[12px] outline-none"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-focus)',
          color: 'var(--apex-text)',
          boxShadow: '0 0 0 1px var(--apex-focus)',
        }}
        autoFocus
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={onSave}
        className="w-6 h-6 rounded-full flex items-center justify-center"
        style={{ color: 'var(--apex-success-text)' }}
      >
        <Check size={14} />
      </button>
      <button
        onClick={onCancel}
        className="w-6 h-6 rounded-full flex items-center justify-center"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        <X size={14} />
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
      onBlur={onCancel}
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
