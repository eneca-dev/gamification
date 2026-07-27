import { z } from 'zod'

// Параметры выгрузки отчёта внедрения. Приходят из URL роут-хендлера — валидируем Zod.
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ожидается дата YYYY-MM-DD')

export const ExportParamsSchema = z
  .object({
    type: z.enum(['employee', 'department', 'company']),
    id: z.string().trim().optional(), // ws_users.id для сотрудника, название отдела — для отдела
    from: dateStr,
    to: dateStr,
  })
  .refine((p) => p.type === 'company' || !!p.id, {
    message: 'Не выбран сотрудник или отдел',
    path: ['id'],
  })
  .refine((p) => p.from <= p.to, {
    message: 'Дата начала позже даты окончания',
    path: ['to'],
  })

export type ExportParams = z.infer<typeof ExportParamsSchema>
export type ReportType = ExportParams['type']

// Одна колонка листа: заголовок + признак числовой (для формата и выравнивания)
export interface SheetColumn {
  header: string
  num?: boolean
  width?: number
}

// Один лист будущего xlsx: имя вкладки, колонки, строки (значения выровнены по колонкам)
export interface ExportSheet {
  name: string
  columns: SheetColumn[]
  rows: (string | number | null)[][]
}

// Готовый отчёт: имя файла + набор листов
export interface ExportReport {
  filename: string
  sheets: ExportSheet[]
}

// Опции для панели фильтров (выпадашки)
export interface ExportOptions {
  employees: { id: string; name: string; department: string }[]
  departments: string[]
}
