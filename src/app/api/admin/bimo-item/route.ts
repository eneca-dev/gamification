import { createHash, randomUUID } from 'node:crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createSupabaseAdminClient } from '@/config/supabase'
import { assertCanUpload } from '@/lib/storage-quota'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'
import { ART_VERSION, ITEM_LAYERS, MAX_DECOR_SYMBOLS, MAX_DECOR_SYMBOL_LENGTH, MAX_LAYER_BYTES, OPTIONAL_LAYERS, parseDecor, parseRigArt, requiredLayers } from '@/modules/bimo-rig'
import { prepareLayer } from '@/modules/bimo-rig/index.server'
import type { BimoArt, BimoLayerName } from '@/modules/bimo-rig'

export const runtime = 'nodejs'
const BUCKET = 'bimo-assets'
const MAX_REQUEST_BYTES = 2 * MAX_LAYER_BYTES + 64 * 1024
const schema = z.object({
  name: z.string().trim().min(2, 'Укажите название').max(200),
  description: z.string().trim().max(1000).nullable(),
  emoji: z.string().trim().max(10).nullable(),
  slug: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Ключ: латинские буквы, цифры и _, начинается с буквы').max(40),
  kind: z.enum(['garment', 'accessory', 'necklace', 'background']),
  costByn: z.number().positive('Себестоимость должна быть больше нуля').finite(),
  coefficient: z.number().positive('Коэффициент должен быть больше нуля').finite(),
  // Декор — только у фонов: массив приводится к шести коротким символам
  // той же функцией, что читает его из каталога.
  decor: z.array(z.string().trim().min(1, 'Эмодзи фона: пустой символ').max(MAX_DECOR_SYMBOL_LENGTH, 'Эмодзи фона: символ слишком длинный')).max(MAX_DECOR_SYMBOLS, 'Эмодзи фона: не больше шести символов').optional(),
})
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status })
const updateSchema = z.object({
  productId: z.string().uuid(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.enum(['garment', 'accessory', 'necklace', 'background']).optional(),
}).strict()

function artworkRevision(row: { art: unknown; art_version: number; fit: unknown }): string {
  return createHash('sha256').update(JSON.stringify([row.art, row.art_version, row.fit])).digest('hex')
}

async function loadDraftArtwork(db: ReturnType<typeof createSupabaseAdminClient>, productId: string) {
  const { data, error } = await db.from('bimo_catalog')
    .select('asset_key,slot,product_id,art,art_version,fit,decor,is_released,product:shop_products!product_id(id,effect,emoji,is_active,is_coming_soon,created_at,updated_at,category_id,sort_order)')
    .eq('product_id', productId).maybeSingle()
  if (error) return { success: false as const, error: 'Не удалось загрузить выбранную вещь', status: 503 }
  if (!data) return { success: false as const, error: 'Вещь не найдена в каталоге Бимо', status: 404 }
  const product = Array.isArray(data.product) ? data.product[0] : data.product
  if (!['outfit', 'background', 'accessory'].includes(data.slot) || !data.asset_key.startsWith(`${data.slot}.`) || product?.id !== productId || product.effect !== `bimo:${data.asset_key}`) {
    return { success: false as const, error: 'Выберите одежду, фон или аксессуар Бимо', status: 400 }
  }
  // Catalog release is the publication gate, checked again by the atomic update.
  // Product availability can be edited independently in the ordinary goods list.
  if (data.is_released !== false) {
    return { success: false as const, error: 'Обновление графики доступно для черновика каталога Бимо', status: 409 }
  }
  return { success: true as const, row: data, product }
}

export async function GET(request: NextRequest) {
  if (!await checkIsAdmin()) return fail('Доступ запрещён', 403)
  const productId = z.string().uuid().safeParse(request.nextUrl.searchParams.get('productId'))
  if (!productId.success) return fail('Неверный идентификатор товара')
  const draft = await loadDraftArtwork(createSupabaseAdminClient(), productId.data)
  if (!draft.success) return fail(draft.error, draft.status)
  return NextResponse.json({ success: true, slot: draft.row.slot, revision: artworkRevision(draft.row), art: parseRigArt(draft.row.art, draft.row.slot, draft.row.art_version), decor: parseDecor(draft.row.decor), emoji: draft.product.emoji ?? null })
}

async function readForm(request: NextRequest): Promise<FormData> {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Error('Нужна форма с файлами')
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) throw new Error('Суммарный размер файлов слишком большой')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Пустой запрос')
  let total = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_REQUEST_BYTES) { await reader.cancel(); throw new Error('Суммарный размер файлов слишком большой') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return new Response(bytes, { headers: { 'content-type': request.headers.get('content-type')! } }).formData()
}

export async function POST(request: NextRequest) {
  if (!await checkIsAdmin()) return fail('Доступ запрещён', 403)
  let form: FormData
  try { form = await readForm(request) }
  catch (error) { return fail(error instanceof Error ? error.message : 'Не удалось прочитать форму') }
  const raw = form.get('fields')
  if (form.getAll('fields').length !== 1) return fail('Передайте поля формы ровно один раз')
  if (typeof raw !== 'string' || raw.length > 8000) return fail('Неверные поля формы')
  let json: unknown
  try { json = JSON.parse(raw) } catch { return fail('Неверные поля формы') }
  const parsed = schema.safeParse(json)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Неверные данные')
  const { name, description, emoji, slug, kind, costByn, coefficient, decor } = parsed.data
  const slot = kind === 'garment' ? 'outfit' : kind === 'background' ? 'background' : 'accessory'
  const assetKey = `${slot}.${slug}`
  const layers = ITEM_LAYERS[kind]
  const prepared = new Map<string, Buffer>()
  try {
    for (const layer of layers) {
      const incoming = form.getAll(layer)
      // Необязательный слой можно не присылать: рукав нужен только образам,
      // где он нарисован отдельно.
      if (!incoming.length && OPTIONAL_LAYERS.includes(layer)) continue
      if (incoming.length !== 1 || !(incoming[0] instanceof File)) return fail('Загрузите каждый слой не больше одного раза')
      const file = incoming[0]
      if (!['image/png', 'image/webp'].includes(file.type)) return fail('Поддерживаются PNG и WebP')
      if (!file.size || file.size > MAX_LAYER_BYTES) return fail('Каждый слой — максимум 2 МБ')
      prepared.set(layer, await prepareLayer(new Uint8Array(await file.arrayBuffer())))
    }
    for (const layer of requiredLayers(kind)) if (!prepared.has(layer)) return fail('Загрузите основной рисунок вещи')
    for (const [key] of form) if (key !== 'fields' && !layers.some(layer => layer === key)) return fail('Для выбранного типа загружен лишний слой')
    await assertCanUpload([...prepared.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0))
  } catch (error) { return fail(error instanceof Error ? error.message : 'Не удалось проверить файлы') }

  const db = createSupabaseAdminClient()
  const existing = await db.from('bimo_catalog').select('asset_key').eq('asset_key', assetKey).maybeSingle()
  if (existing.error) return fail('Не удалось проверить каталог', 503)
  if (existing.data) return fail('Вещь с таким ключом уже есть', 409)
  const category = await db.from('shop_categories').select('id').eq('slug', 'artifact').maybeSingle()
  if (category.error || !category.data) return fail('Категория Бимо недоступна', 503)
  const lastOrder = await db.from('shop_products').select('sort_order').like('effect', 'bimo:%').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  if (lastOrder.error) return fail('Не удалось проверить порядок товаров', 503)
  // Own every resource before sending the first write. A timed-out response
  // does not tell us whether the database/storage committed the request.
  const attempt = randomUUID()
  const attemptedPaths: string[] = []
  let product: { id: string; created_at: string; updated_at: string; sort_order: number } | null = null
  const art: BimoArt = {}
  async function rollback(): Promise<boolean> {
    let clean = true
    // Remove references first. If this cannot be confirmed, retain their files
    // and product so that a possibly committed catalog entry stays intact.
    try {
      const { error } = await db.from('bimo_catalog').delete().eq('product_id', attempt)
      if (error) { console.error('[bimo-item] cleanup catalog', attempt, error.message); return false }
    } catch (error) { console.error('[bimo-item] cleanup catalog', attempt, error); return false }
    try {
      const { error } = await db.from('shop_products').delete().eq('id', attempt)
      if (error) { clean = false; console.error('[bimo-item] cleanup product', attempt, error.message) }
    } catch (error) { clean = false; console.error('[bimo-item] cleanup product', attempt, error) }
    try {
      if (attemptedPaths.length) {
        const { error } = await db.storage.from(BUCKET).remove(attemptedPaths)
        if (error) { clean = false; console.error('[bimo-item] cleanup files', attempt, error.message) }
      }
    } catch (error) { clean = false; console.error('[bimo-item] cleanup files', attempt, error) }
    return clean
  }
  try {
    const created = await db.from('shop_products').insert({
      id: attempt, name, description, emoji, cost_byn: costByn, coefficient,
      category_id: category.data.id, effect: `bimo:${assetKey}`,
      is_active: false, is_coming_soon: false,
      sort_order: Math.max(1010, Number(lastOrder.data?.sort_order ?? 0) + 1),
    }).select('id,created_at,updated_at,sort_order').single()
    if (created.error || !created.data) throw new Error('Не удалось создать черновик')
    product = created.data
    for (const layer of layers) {
      const bytes = prepared.get(layer)
      if (!bytes) continue
      const path = `${slot}/${attempt}/v${ART_VERSION}/${layer}.webp`
      attemptedPaths.push(path)
      const result = await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' })
      if (result.error) throw new Error('Не удалось загрузить слои вещи')
      art[layer] = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }
    const catalog = await db.from('bimo_catalog').insert({
      asset_key: assetKey, slot, product_id: attempt, is_released: false,
      art, art_version: ART_VERSION, fit: { dx: 0, dy: 0, scale: 1 },
      decor: slot === 'background' ? parseDecor(decor) : [],
    })
    if (catalog.error) throw new Error(catalog.error.code === '23505' ? 'Вещь с таким ключом уже создана' : 'Не удалось сохранить вещь в каталог')
  } catch (error) {
    const clean = await rollback()
    return fail(clean ? (error instanceof Error ? error.message : 'Не удалось сохранить вещь') : 'Сохранение не завершено. Автоматическая очистка выполнена частично; сообщите администратору', 503)
  }
  revalidatePath('/store'); revalidatePath('/activity'); revalidatePath('/admin')
  revalidateTag('storage-used-bytes', 'max')
  return NextResponse.json({ success: true, ...product, category_id: category.data.id, effect: `bimo:${assetKey}` })
}

export async function PATCH(request: NextRequest) {
  if (!await checkIsAdmin()) return fail('Доступ запрещён', 403)
  let form: FormData
  try { form = await readForm(request) }
  catch (error) { return fail(error instanceof Error ? error.message : 'Не удалось прочитать форму') }
  const raw = form.get('fields')
  if (form.getAll('fields').length !== 1 || typeof raw !== 'string' || raw.length > 8000) return fail('Неверные поля формы')
  let json: unknown
  try { json = JSON.parse(raw) } catch { return fail('Неверные поля формы') }
  const parsed = updateSchema.safeParse(json)
  if (!parsed.success) return fail('Неверные данные обновления графики')
  const db = createSupabaseAdminClient()
  const draft = await loadDraftArtwork(db, parsed.data.productId)
  if (!draft.success) return fail(draft.error, draft.status)
  const kind = parsed.data.kind ?? (draft.row.slot === 'background' ? 'background' : undefined)
  if (!kind) return fail('Укажите тип рисунка вещи')
  const slot = kind === 'garment' ? 'outfit' : kind === 'background' ? 'background' : 'accessory'
  if (draft.row.slot !== slot) return fail('Тип рисунка не соответствует выбранному товару')
  const layers = ITEM_LAYERS[kind]
  if (artworkRevision(draft.row) !== parsed.data.revision) return fail('Графика уже изменена. Закройте форму и откройте вещь заново', 409)
  if ([...form.keys()].some(key => key !== 'fields' && !layers.some(layer => layer === key))) return fail('Для выбранного типа загружен лишний слой')
  const prepared = new Map<BimoLayerName, Buffer>()
  try {
    for (const layer of layers) {
      const incoming = form.getAll(layer)
      if (!incoming.length && OPTIONAL_LAYERS.includes(layer)) continue
      if (incoming.length !== 1 || !(incoming[0] instanceof File)) return fail('Загрузите каждый слой не больше одного раза')
      const file = incoming[0]
      if (!['image/png', 'image/webp'].includes(file.type)) return fail('Поддерживаются PNG и WebP')
      if (!file.size || file.size > MAX_LAYER_BYTES) return fail('Каждый слой — максимум 2 МБ')
      prepared.set(layer, await prepareLayer(new Uint8Array(await file.arrayBuffer())))
    }
    for (const layer of requiredLayers(kind)) if (!prepared.has(layer)) return fail('Загрузите основной рисунок вещи')
    await assertCanUpload([...prepared.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0))
  } catch (error) { return fail(error instanceof Error ? error.message : 'Не удалось проверить рисунок') }

  const attemptRoot = `${draft.row.slot}/${draft.row.product_id}/v${ART_VERSION}/${randomUUID()}`
  const attemptedPaths: string[] = []
  const art: BimoArt = {}
  let switchAttempted = false
  async function discardAttempt(): Promise<boolean> {
    try {
      const { error } = await db.storage.from(BUCKET).remove(attemptedPaths)
      if (error) console.error('[bimo-item] cleanup artwork attempt', attemptRoot, error.message)
      return !error
    } catch (error) { console.error('[bimo-item] cleanup artwork attempt', attemptRoot, error); return false }
  }
  try {
    for (const layer of layers) {
      const bytes = prepared.get(layer)
      if (!bytes) continue
      const objectPath = `${attemptRoot}/${layer}.webp`
      attemptedPaths.push(objectPath)
      const upload = await db.storage.from(BUCKET).upload(objectPath, bytes, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' })
      if (upload.error) throw new Error('Не удалось загрузить слои вещи')
      art[layer] = db.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl
    }
    let update = db.from('bimo_catalog').update({ art, art_version: ART_VERSION, fit: { dx: 0, dy: 0, scale: 1 } })
      .eq('asset_key', draft.row.asset_key).eq('product_id', draft.row.product_id)
      .eq('slot', draft.row.slot).eq('is_released', false).eq('art_version', draft.row.art_version)
    update = draft.row.art === null ? update.is('art', null) : update.eq('art', JSON.stringify(draft.row.art))
    update = draft.row.fit === null ? update.is('fit', null) : update.eq('fit', JSON.stringify(draft.row.fit))
    switchAttempted = true
    const changed = await update.select('asset_key').maybeSingle()
    if (changed.error) throw new Error('Не удалось подтвердить сохранение графики')
    if (!changed.data) {
      if (!await discardAttempt()) return fail('Не удалось очистить временный рисунок. Сообщите администратору', 503)
      return fail('Графика уже изменена. Закройте форму и откройте вещь заново', 409)
    }
  } catch (error) {
    if (!switchAttempted) {
      if (!await discardAttempt()) return fail('Не удалось очистить временный рисунок. Сообщите администратору', 503)
      return fail(error instanceof Error ? error.message : 'Не удалось загрузить рисунок', 503)
    }
    // A lost update response can follow a committed write. Keep its files while
    // the outcome is uncertain, including when a read still sees the old row.
    try {
      const current = await db.from('bimo_catalog').select('art,art_version').eq('product_id', draft.row.product_id).maybeSingle()
      const savedArt = current.data ? parseRigArt(current.data.art, draft.row.slot, current.data.art_version) : null
      if (current.error || !layers.every(layer => savedArt?.[layer] === art[layer])) return fail('Не удалось подтвердить сохранение. Откройте вещь заново и проверьте изображение', 503)
    } catch { return fail('Не удалось подтвердить сохранение. Откройте вещь заново и проверьте изображение', 503) }
  }
  revalidatePath('/store'); revalidatePath('/activity'); revalidatePath('/admin/products')
  revalidateTag('storage-used-bytes', 'max')
  return NextResponse.json({ success: true, ...draft.product })
}
