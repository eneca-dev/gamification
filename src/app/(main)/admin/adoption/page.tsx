import { redirect } from 'next/navigation'

import {
  checkIsAdmin,
  getAdoptionPeriodDashboard,
  getAdoptionMonthlyReport,
  getAllDepartments,
} from '@/modules/admin'
import type { AdoptionCohortScope, AdoptionDateRange, AdoptionMonthlyFilters } from '@/modules/admin'
import { getExportOptions } from '@/modules/admin/export/options'
import { AdoptionDashboard } from '@/modules/admin/components/adoption/AdoptionDashboard'

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function maxReportDate() {
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  return yesterday.toISOString().slice(0, 10)
}

function resolveDateRange(params: Record<string, string | string[] | undefined>): AdoptionDateRange {
  const maxTo = maxReportDate()
  const rawFrom = scalar(params.from)
  const rawTo = scalar(params.to)
  const valid = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  // Пустой фильтр = период внедрения, включая базовые дни 29–30 июня.
  let from = valid(rawFrom) ? rawFrom! : '2026-06-29'
  let to = valid(rawTo) ? rawTo! : maxTo
  if (to > maxTo) to = maxTo
  if (from && from > to) {
    const previousFrom = from
    from = to
    to = previousFrom
  }
  return { from, to }
}

function resolveReportMonth(params: Record<string, string | string[] | undefined>, fallback: string) {
  const rawMonth = scalar(params.month)
  const month = rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : fallback.slice(0, 7)
  const [year, monthNumber] = month.split('-').map(Number)
  return {
    month,
    from: `${month}-01`,
    to: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10),
  }
}

export default async function AdoptionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const params = await searchParams
  const range = resolveDateRange(params)
  const rawScope = Array.isArray(params.scope) ? params.scope[0] : params.scope
  const scope: AdoptionCohortScope = rawScope === 'all' || rawScope === 'selected' ? rawScope : 'designer'
  const rawDepartments = Array.isArray(params.departments) ? params.departments[0] : params.departments
  const departments = rawDepartments ? [...new Set(rawDepartments.split(',').map((item) => item.trim()).filter(Boolean))] : []
  const reportMonth = resolveReportMonth(params, maxReportDate())
  const filters: AdoptionMonthlyFilters = { ...reportMonth, scope, departments }
  const previousDate = new Date(`${reportMonth.from}T00:00:00Z`)
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1)
  const previousMonth = previousDate.toISOString().slice(0, 7)
  const [previousYear, previousMonthNumber] = previousMonth.split('-').map(Number)
  const previousFilters: AdoptionMonthlyFilters = {
    month: previousMonth,
    from: `${previousMonth}-01`,
    to: new Date(Date.UTC(previousYear, previousMonthNumber, 0)).toISOString().slice(0, 10),
    scope,
    departments,
  }

  const [periodData, exportOptions, monthly, previousMonthly, allDepartments] = await Promise.all([
    getAdoptionPeriodDashboard(range),
    getExportOptions(),
    getAdoptionMonthlyReport(filters),
    getAdoptionMonthlyReport(previousFilters),
    getAllDepartments(),
  ])

  return (
    <AdoptionDashboard
      coverage={periodData.coverage}
      overview={periodData.overview}
      worksection={periodData.worksection}
      plugins={periodData.plugins}
      sideEffects={periodData.sideEffects}
      exportOptions={exportOptions}
      monthly={monthly}
      previousMonthly={previousMonthly}
      monthlyFilters={filters}
      departments={allDepartments}
      dateRange={range}
    />
  )
}
