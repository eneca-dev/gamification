'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, Pencil, Ticket, Users, Upload, X, AlertTriangle } from 'lucide-react'

import { CoinIcon } from '@/components/CoinIcon'
import { createLottery, updateLottery } from '@/modules/lottery/index.client'
import { uploadProductImage } from '@/modules/shop/index.client'
import { formatLotteryMonth } from '@/modules/lottery/utils'

import type { LotteryWithStats } from '@/modules/lottery/index.client'

interface LotteryAdminProps {
  lotteries: LotteryWithStats[]
}

export function LotteryAdmin({ lotteries: initialLotteries }: LotteryAdminProps) {
  const [lotteries, setLotteries] = useState(initialLotteries)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingLottery, setEditingLottery] = useState<LotteryWithStats | null>(null)
  const [showEditWarning, setShowEditWarning] = useState(false)

  // Форма создания/редактирования
  const [form, setForm] = useState({
    name: '',
    description: '',
    ticket_price: 300,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeLottery = lotteries.find((l) => l.status === 'active')
  const completedLotteries = lotteries.filter((l) => l.status === 'completed')

  function showNotif(msg: string) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  function processFile(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Формат: JPEG, PNG или WebP')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Максимум 2 МБ')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function handleRemoveImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function startEditing(lottery: LotteryWithStats) {
    setForm({
      name: lottery.name,
      description: lottery.description ?? '',
      ticket_price: lottery.ticket_price,
    })
    setImagePreview(lottery.image_url)
    setImageFile(null)
    setEditingLottery(lottery)

    // Показываем предупреждение, если уже есть купленные билеты
    if (lottery.total_tickets > 0) {
      setShowEditWarning(true)
    }
  }

  function cancelEditing() {
    setEditingLottery(null)
    setShowEditWarning(false)
    setForm({ name: '', description: '', ticket_price: 300 })
    handleRemoveImage()
    setError(null)
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return null
    const fd = new FormData()
    fd.append('file', imageFile)
    const uploadResult = await uploadProductImage(fd)
    if (!uploadResult.success) {
      setError(uploadResult.error)
      return null
    }
    return uploadResult.url
  }

  function handleCreate() {
    setError(null)
    const prev = lotteries

    startTransition(async () => {
      const imageUrl = await uploadImage()
      if (imageFile && !imageUrl) return

      const result = await createLottery({
        name: form.name,
        description: form.description || null,
        image_url: imageUrl,
        ticket_price: form.ticket_price,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setLotteries([
        { ...result.data, total_tickets: 0, total_participants: 0 },
        ...prev,
      ])
      setForm({ name: '', description: '', ticket_price: 300 })
      handleRemoveImage()
      setShowForm(false)
      showNotif('Лотерея создана')
    })
  }

  function handleUpdate() {
    if (!editingLottery) return
    setError(null)
    const prev = lotteries

    startTransition(async () => {
      const newImageUrl = await uploadImage()
      if (imageFile && !newImageUrl) return

      // Если загружена новая картинка — используем её, иначе оставляем текущую
      const finalImageUrl = newImageUrl ?? (imageFile === null ? imagePreview : null)

      const result = await updateLottery({
        id: editingLottery.id,
        name: form.name,
        description: form.description || null,
        image_url: finalImageUrl,
        ticket_price: form.ticket_price,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setLotteries(
        prev.map((l) =>
          l.id === editingLottery.id
            ? { ...l, ...result.data, total_tickets: l.total_tickets, total_participants: l.total_participants }
            : l
        )
      )
      cancelEditing()
      showNotif('Лотерея обновлена')
    })
  }

  return (
    <div className="space-y-6">
      {/* Уведомления */}
      {notification && (
        <div
          className="px-4 py-2.5 rounded-lg text-sm font-medium"
          style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}
        >
          {notification}
        </div>
      )}
      {error && (
        <div className="px-4 py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-600">
          {error}
        </div>
      )}

      {/* Текущая лотерея */}
      <section>
        <div className="flex items-center justify-between mb-4" data-onboarding="lottery-current-section">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--apex-text-primary)' }}>
            Текущая лотерея
          </h2>
          {!activeLottery && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white transition-colors"
              style={{ background: 'var(--apex-primary)' }}
            >
              <Plus size={16} />
              Создать лотерею
            </button>
          )}
        </div>

        {showForm && !activeLottery && (
          <div
            className="rounded-xl p-5 space-y-4"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--apex-border)' }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--apex-text-primary)' }}>
              Новая лотерея на {formatLotteryMonth(new Date().toISOString())}
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--apex-text-secondary)' }}>
                  Название приза *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Logitech MX Master 3S"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--apex-border)',
                    color: 'var(--apex-text-primary)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--apex-text-secondary)' }}>
                  Цена билета <CoinIcon size={12} className="inline" />
                </label>
                <input
                  type="number"
                  value={form.ticket_price}
                  onChange={(e) => setForm({ ...form, ticket_price: Number(e.target.value) })}
                  min={1}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--apex-border)',
                    color: 'var(--apex-text-primary)',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--apex-text-secondary)' }}>
                Описание
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Описание приза (необязательно)"
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--apex-border)',
                  color: 'var(--apex-text-primary)',
                }}
              />
            </div>

            {/* Загрузка картинки */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--apex-text-secondary)' }}>
                Фото приза
              </label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Превью приза"
                    className="w-32 h-32 object-contain rounded-lg"
                    style={{ border: '1px solid var(--apex-border)' }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white"
                    style={{ background: 'var(--apex-danger)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl cursor-pointer transition-colors text-center"
                  style={{
                    border: `2px dashed ${isDragging ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
                    background: isDragging ? 'var(--apex-success-bg)' : 'var(--surface)',
                  }}
                >
                  <Upload size={20} style={{ color: 'var(--apex-text-secondary)' }} />
                  <p className="text-xs" style={{ color: 'var(--apex-text-secondary)' }}>
                    Перетащите или нажмите для загрузки
                  </p>
                  <p className="text-xs" style={{ color: 'var(--apex-text-muted)' }}>
                    JPEG, PNG, WebP · до 2 МБ
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!form.name.trim() || isPending}
                className="px-4 py-2 rounded-full text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--apex-primary)' }}
              >
                {isPending ? 'Создаём...' : 'Создать'}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(null) }}
                className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
                style={{ color: 'var(--apex-text-secondary)' }}
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {activeLottery && !editingLottery && (
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--apex-border)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-4">
                {activeLottery.image_url ? (
                  <img
                    src={activeLottery.image_url}
                    alt={activeLottery.name}
                    className="w-20 h-20 object-contain rounded-lg flex-shrink-0"
                    style={{ border: '1px solid var(--apex-border)' }}
                  />
                ) : (
                  <span className="text-lg">🎟️</span>
                )}
                <div>
                  <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--apex-text-primary)' }}>
                    {activeLottery.name}
                  </h3>
                  {activeLottery.description && (
                    <p className="text-sm" style={{ color: 'var(--apex-text-secondary)' }}>
                      {activeLottery.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEditing(activeLottery)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{ color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)' }}
                >
                  <Pencil size={13} />
                  Изменить приз
                </button>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}
                >
                  Активна
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<Ticket size={16} />} label="Билетов продано" value={activeLottery.total_tickets} />
              <StatCard icon={<Users size={16} />} label="Участников" value={activeLottery.total_participants} />
              <StatCard
                icon={<CoinIcon size={16} />}
                label="Цена билета"
                value={activeLottery.ticket_price}
              />
              <StatCard
                icon={<CoinIcon size={16} />}
                label="💎 выведено"
                value={activeLottery.total_tickets * activeLottery.ticket_price}
              />
            </div>
          </div>
        )}

        {/* Форма редактирования активной лотереи */}
        {editingLottery && (
          <div
            className="rounded-xl p-5 space-y-4"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--apex-border)' }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--apex-text-primary)' }}>
              Редактирование приза
            </h3>

            {showEditWarning && (
              <div
                className="flex items-start gap-3 px-4 py-3 rounded-lg text-sm"
                style={{ background: 'var(--apex-warning-bg)', color: 'var(--apex-warning-text)' }}
              >
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-0.5">Лотерея уже идёт</p>
                  <p className="text-xs" style={{ opacity: 0.85 }}>
                    Продано {editingLottery.total_tickets} {editingLottery.total_tickets === 1 ? 'билет' : editingLottery.total_tickets < 5 ? 'билета' : 'билетов'} ({editingLottery.total_participants} {editingLottery.total_participants === 1 ? 'участник' : editingLottery.total_participants < 5 ? 'участника' : 'участников'}).
                    Люди покупали билеты на другой приз — убедитесь, что изменение оправдано.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--apex-text-secondary)' }}>
                  Название приза *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Logitech MX Master 3S"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--apex-border)',
                    color: 'var(--apex-text-primary)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--apex-text-secondary)' }}>
                  Цена билета <CoinIcon size={12} className="inline" />
                </label>
                <input
                  type="number"
                  value={form.ticket_price}
                  onChange={(e) => setForm({ ...form, ticket_price: Number(e.target.value) })}
                  min={1}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--apex-border)',
                    color: 'var(--apex-text-primary)',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--apex-text-secondary)' }}>
                Описание
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Описание приза (необязательно)"
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--apex-border)',
                  color: 'var(--apex-text-primary)',
                }}
              />
            </div>

            {/* Загрузка картинки */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--apex-text-secondary)' }}>
                Фото приза
              </label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Превью приза"
                    className="w-32 h-32 object-contain rounded-lg"
                    style={{ border: '1px solid var(--apex-border)' }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white"
                    style={{ background: 'var(--apex-danger)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl cursor-pointer transition-colors text-center"
                  style={{
                    border: `2px dashed ${isDragging ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
                    background: isDragging ? 'var(--apex-success-bg)' : 'var(--surface)',
                  }}
                >
                  <Upload size={20} style={{ color: 'var(--apex-text-secondary)' }} />
                  <p className="text-xs" style={{ color: 'var(--apex-text-secondary)' }}>
                    Перетащите или нажмите для загрузки
                  </p>
                  <p className="text-xs" style={{ color: 'var(--apex-text-muted)' }}>
                    JPEG, PNG, WebP · до 2 МБ
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleUpdate}
                disabled={!form.name.trim() || isPending}
                className="px-4 py-2 rounded-full text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--apex-primary)' }}
              >
                {isPending ? 'Сохраняем...' : 'Сохранить'}
              </button>
              <button
                onClick={cancelEditing}
                className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
                style={{ color: 'var(--apex-text-secondary)' }}
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {!activeLottery && !showForm && (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--apex-border)' }}
          >
            <div className="text-3xl mb-2">🎰</div>
            <p className="text-sm" style={{ color: 'var(--apex-text-secondary)' }}>
              Нет активной лотереи. Создайте розыгрыш на текущий месяц.
            </p>
          </div>
        )}
      </section>

      {/* История */}
      {completedLotteries.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--apex-text-primary)' }}>
            История розыгрышей
          </h2>
          <div className="space-y-3">
            {completedLotteries.map((lottery) => (
              <div
                key={lottery.id}
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--apex-border)' }}
              >
                <div className="flex-shrink-0 text-2xl">🏆</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold" style={{ color: 'var(--apex-text-primary)' }}>
                      {lottery.name}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--surface)', color: 'var(--apex-text-secondary)' }}
                    >
                      {formatLotteryMonth(lottery.month)}
                    </span>
                  </div>
                  {lottery.winner && (
                    <p className="text-sm" style={{ color: 'var(--apex-text-secondary)' }}>
                      Победитель: <span className="font-medium" style={{ color: 'var(--apex-primary)' }}>
                        {lottery.winner.first_name} {lottery.winner.last_name}
                      </span>
                      {lottery.winner.department && (
                        <span className="ml-1 text-xs">({lottery.winner.department})</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--apex-text-primary)' }}>
                    <Ticket size={14} />
                    {lottery.total_tickets}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--apex-text-secondary)' }}>
                    {lottery.total_participants} уч.
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--surface)' }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--apex-text-secondary)' }}>
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-semibold" style={{ color: 'var(--apex-text-primary)' }}>
        {value.toLocaleString('ru-RU')}
      </div>
    </div>
  )
}
