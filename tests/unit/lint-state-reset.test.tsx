import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RedDayCalendar } from '@/modules/corrections/components/RedDayCalendar'
import { UserAppealsCard } from '@/modules/corrections/components/UserAppealsCard'
import { UsersTable } from '@/modules/admin/components/UsersTable'
import type { CorrectionCalendarDay, CorrectionUserAppeal } from '@/modules/corrections/types'

vi.mock('@/modules/feedback/index.client', () => ({ updateAppealStatus: vi.fn(), appealStatusLabels: { new: 'New' } }))
vi.mock('@/modules/admin/index.client', () => ({ toggleAdmin: vi.fn() }))
vi.mock('@/components/CoinBalance', () => ({ CoinStatic: ({ amount }: { amount: number }) => <span>{amount}</span> }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

function days(months: number): CorrectionCalendarDay[] {
  return Array.from({ length: months }, (_, i) => ({ date: `2026-${String(i + 1).padStart(2, '0')}-01`, status: 'red', label: '', coins: 0, absence_type: null, revit_launches: 0, has_shield: false }))
}
it('clamps calendar position permanently when its range shrinks then grows', () => {
  const props = { selected: new Set<string>(), onToggle: vi.fn() }
  const view = render(<RedDayCalendar {...props} days={days(8)} />)
  expect((screen.getByLabelText('На месяц вперёд') as HTMLButtonElement).disabled).toBe(true)
  view.rerender(<RedDayCalendar {...props} days={days(3)} />)
  view.rerender(<RedDayCalendar {...props} days={days(8)} />)
  expect((screen.getByLabelText('На месяц назад') as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByLabelText('На месяц вперёд') as HTMLButtonElement).disabled).toBe(false)
  view.rerender(<RedDayCalendar {...props} days={[]} />)
  expect(screen.getByText('Нет данных по дням')).toBeTruthy()
})

const appeal = (id: string): CorrectionUserAppeal => ({ id, created_at: '2026-11-18', status: 'new', description: 'Appeal ' + id, task_url: null, dates: null, transactions: [], total_coins: null, image_urls: [], review_comment: null, reviewed_at: null })
it('expands only on a new highlight, keeps review drafts, and cleans up scrolling', () => {
  vi.useFakeTimers()
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  const appeals = [appeal('a'), appeal('b')]
  const view = render(<UserAppealsCard appeals={appeals} highlightAppealId="a" />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Отклонить' })[0])
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'draft explanation' } })
  view.rerender(<UserAppealsCard appeals={appeals} highlightAppealId="b" />)
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('draft explanation')
  fireEvent.click(screen.getByRole('button', { name: /Обжалования от пользователя/ }))
  view.rerender(<UserAppealsCard appeals={[...appeals]} highlightAppealId="b" />)
  expect(screen.queryByText('Appeal b')).toBeNull()
  view.rerender(<UserAppealsCard appeals={appeals} highlightAppealId="a" />)
  expect(screen.getByText('Appeal a')).toBeTruthy()
  view.unmount()
  act(() => vi.advanceTimersByTime(500))
  expect(scroll).not.toHaveBeenCalled()
})

it('applies collapse/expand controls again after manual department toggles', () => {
  render(<UsersTable users={[{ id: 'a', email: 'a@example.invalid', first_name: 'Alice', last_name: 'User', department: 'Department', team: null, is_admin: false, is_active: true, total_coins: 10 }]} />)
  expect(screen.getByText('User Alice')).toBeTruthy()
  fireEvent.click(screen.getByTitle('Свернуть все'))
  expect(screen.queryByText('User Alice')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Department.*1 сотр/ }))
  expect(screen.getByText('User Alice')).toBeTruthy()
  fireEvent.click(screen.getByTitle('Свернуть все'))
  expect(screen.queryByText('User Alice')).toBeNull()
  fireEvent.click(screen.getByTitle('Развернуть все'))
  expect(screen.getByText('User Alice')).toBeTruthy()
})
