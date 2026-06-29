'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Plus, Pencil, Ticket, Users, Upload, X, AlertTriangle } from 'lucide-react'

import { CoinIcon } from '@/components/CoinIcon'
import { createLottery, updateLottery } from '@/modules/lottery/index.client'
import { uploadProductImage, computePriceCrystals, coinsToByn } from '@/modules/shop/index.client'
import { formatLotteryMonth } from '@/modules/lottery/utils'

import type { LotteryWithStats } from '@/modules/lottery/index.client'

interface LotteryAdminProps {
  lotteries: LotteryWithStats[]
  rate: number
}

export function LotteryAdmin({ lotteries: initialLotteries, rate }: LotteryAdminProps) {
  const [lotteries, setLotteries] = useState(initialLotteries)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingLottery, setEditingLottery] = useState<LotteryWithStats | null>(null)
  const [showEditWarning, setShowEditWarning] = useState(false)

  // Форма создания/редактирования. cost_byn хранится строкой для свободного ввода ("3,5", "")
  const [form, setForm] = useState<{ name: string; description: string; cost_byn: string }>({
    name: '',
    description: '',
    cost_byn: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!showForm && !editingLottery) return
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) { processFile(file); break }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [showForm, editingLottery])

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
    // Восстанавливаем BYN из закэшированных кристаллов по текущему курсу
    const bynValue = coinsToByn(lottery.ticket_price, rate)
    setForm({
      name: lottery.name,
      description: lottery.description ?? '',
      cost_byn: String(bynValue).replace('.', ','),
    })
    setImagePreview(lottery.image_url)
    setImageFile(null)
    setEditingLottery(lottery)

    // Показываем предупреждение, если уже есть игроки
    if (lottery.total_tickets > 0) {
      setShowEditWarning(true)
    }
  }

  function cancelEditing() {
    setEditingLottery(null)
    setShowEditWarning(false)
    setForm({ name: '', description: '', cost_byn: '' })
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

  const costBynNum = parseFloat(form.cost_byn.replace(',', '.')) || 0
  const previewCrystals = costBynNum > 0 ? computePriceCrystals(costBynNum, 1, rate) : 0

  function handleCreate() {
    setError(null)
    if (costBynNum <= 0) {
      setError('Стоимость игры должна быть больше 0')
      return
    }
    const prev = lotteries

    startTransition(async () => {
      const imageUrl = await uploadImage()
      if (imageFile && !imageUrl) return

      const result = await createLottery({
        name: form.name,
        description: form.description || null,
        image_url: imageUrl,
        cost_byn: costBynNum,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setLotteries([
        { ...result.data, total_tickets: 0, total_participants: 0 },
        ...prev,
      ])
      setForm({ name: '', description: '', cost_byn: '' })
      handleRemoveImage()
      setShowForm(false)
      showNotif('eneca-game запущена')
    })
  }

  function handleUpdate() {
    if (!editingLottery) return
    setError(null)
    if (costBynNum <= 0) {
      setError('Стоимость игры должна быть больше 0')
      return
    }
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
        cost_byn: costBynNum,
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
      showNotif('eneca-game обновлена')
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

      {/* Текущая eneca-game */}
      <section>
        <div className="flex items-center justify-between mb-4" data-onboarding="lottery-current-section">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--apex-text-primary)' }}>
            Текущая eneca-game
          </h2>
          {!activeLottery && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white transition-colors"
              style={{ background: 'var(--apex-primary)' }}
            >
              <Plus size={16} />
              Запустить eneca-game
            </button>
          )}
        </div>

        {showForm && !activeLottery && (
          <div
            className="rounded-xl p-5 space-y-4"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--apex-border)' }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--apex-text-primary)' }}>
              eneca-game на {formatLotteryMonth(new Date().toISOString())}
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
                  Стоимость игры (BYN)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.cost_byn}
                  onChange={(e) => setForm({ ...form, cost_byn: e.target.value })}
                  placeholder="3,50"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--apex-border)',
                    color: 'var(--apex-text-primary)',
                  }}
                />
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--apex-text-secondary)' }}>
                  ≈ {previewCrystals.toLocaleString('ru-RU')} <CoinIcon size={12} />
                  <span style={{ color: 'var(--apex-text-muted)' }}>(курс 1 BYN = {rate} 💎)</span>
                </p>
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
                    Перетащите, нажмите или Ctrl+V
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
              <StatCard icon={<Ticket size={16} />} label="Сыграно раз" value={activeLottery.total_tickets} />
              <StatCard icon={<Users size={16} />} label="Игроков" value={activeLottery.total_participants} />
              <StatCard
                icon={<CoinIcon size={16} />}
                label="Стоимость игры"
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

        {/* Форма редактирования */}
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
                  <p className="font-semibold mb-0.5">Игра уже идёт</p>
                  <p className="text-xs" style={{ opacity: 0.85 }}>
                    Сыграли {editingLottery.total_tickets} раз ({editingLottery.total_participants} {editingLottery.total_participants === 1 ? 'игрок' : editingLottery.total_participants < 5 ? 'игрока' : 'игроков'}).
                    Люди уже вошли в игру на другой приз — убедитесь, что изменение оправдано.
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
                  Стоимость игры (BYN)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.cost_byn}
                  onChange={(e) => setForm({ ...form, cost_byn: e.target.value })}
                  placeholder="3,50"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--apex-border)',
                    color: 'var(--apex-text-primary)',
                  }}
                />
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--apex-text-secondary)' }}>
                  ≈ {previewCrystals.toLocaleString('ru-RU')} <CoinIcon size={12} />
                  <span style={{ color: 'var(--apex-text-muted)' }}>(курс 1 BYN = {rate} 💎)</span>
                </p>
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
                    Перетащите, нажмите или Ctrl+V
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
              Нет активной игры. Запустите eneca-game на текущий месяц.
            </p>
          </div>
        )}
      </section>

      {/* История */}
      {completedLotteries.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--apex-text-primary)' }}>
            История eneca-game
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
                    {lottery.total_participants} игр.
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