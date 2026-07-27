import { NextResponse, type NextRequest } from 'next/server'

import { checkIsAdmin } from '@/modules/admin'
import { getCompanyReport, getDepartmentReport, getEmployeeReport } from '@/modules/admin/export/queries'
import { ExportParamsSchema } from '@/modules/admin/export/types'
import { buildWorkbook } from '@/modules/admin/export/workbook'

// Выгрузка отчёта внедрения в xlsx. Только для админов. Параметры — из query.
export async function GET(request: NextRequest) {
  if (!(await checkIsAdmin())) {
    return NextResponse.json({ error: 'Доступ только для администраторов' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const parsed = ExportParamsSchema.safeParse({
    type: sp.get('type'),
    id: sp.get('id') ?? undefined,
    from: sp.get('from'),
    to: sp.get('to'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Некорректные параметры' }, { status: 400 })
  }
  const { type, id, from, to } = parsed.data

  try {
    const report =
      type === 'employee' ? await getEmployeeReport(id!, from, to)
      : type === 'department' ? await getDepartmentReport(id!, from, to)
      : await getCompanyReport(from, to)

    const buffer = await buildWorkbook(report.sheets)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(report.filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка формирования отчёта'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
