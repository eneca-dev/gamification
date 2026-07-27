import ExcelJS from 'exceljs'

import type { ExportSheet } from './types'

// Собирает xlsx из подготовленных листов: жирная закреплённая шапка, автофильтр,
// автоширина колонок, числовой формат и выравнивание числовых столбцов.
export async function buildWorkbook(sheets: ExportSheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'eneca gamification'

  for (const sh of sheets) {
    const ws = wb.addWorksheet(sh.name.slice(0, 31))

    ws.columns = sh.columns.map((c, i) => {
      const maxLen = Math.max(
        c.header.length,
        ...sh.rows.map((r) => String(r[i] ?? '').length),
      )
      return { header: c.header, width: c.width ?? Math.min(55, maxLen + 2) }
    })

    for (const r of sh.rows) ws.addRow(r)

    const header = ws.getRow(1)
    header.font = { bold: true }
    header.alignment = { vertical: 'middle', wrapText: false }
    header.height = 18
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    if (sh.rows.length > 0) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sh.columns.length } }
    }

    sh.columns.forEach((c, i) => {
      if (!c.num) return
      const col = ws.getColumn(i + 1)
      // если в столбце есть дробные значения — формат с десятичными,
      // иначе целочисленный (без десятичного разделителя в конце)
      const hasFraction = sh.rows.some((r) => typeof r[i] === 'number' && !Number.isInteger(r[i] as number))
      col.numFmt = hasFraction ? '#,##0.##' : '#,##0'
      col.alignment = { horizontal: 'right' }
    })
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
