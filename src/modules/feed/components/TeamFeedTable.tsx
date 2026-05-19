'use client'

import { Fragment } from 'react'
import { Users, Handshake } from 'lucide-react'

import { AchBadges, AchBreakdownCell, CoinCell, CountBadge, GratBadges, InfoIcon } from './FeedBadges'
import { CELL, COIN_GAP, HEADER_STYLE, ROW_STYLE } from './feed-table-styles'
import type { TeamFeedData } from '../types'


interface TeamFeedTableProps {
  data: TeamFeedData
  monthLabel: string
}

export function TeamFeedTable({ data, monthLabel }: TeamFeedTableProps) {
  if (data.members.length === 0) {
    return (
      <div className="rounded-2xl py-10 text-center" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
        <div className="text-2xl mb-2">👥</div>
        <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Нет данных по команде</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div
        data-onboarding="team-feed-table"
        className="rounded-2xl overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateColumns: '220px max-content max-content 250px 1fr',
          border: '1px solid var(--border)',
          minWidth: '580px',
        }}
      >
        {/* Шапка колонок */}
        <div className={`${CELL} text-[10px] font-bold`} style={HEADER_STYLE}>
          <span style={{ color: 'var(--text-muted)' }}>Участник</span>
        </div>
        <div className={`${CELL} justify-center gap-1 text-[10px] font-bold`} style={{ ...HEADER_STYLE, ...COIN_GAP }}>
          <span style={{ color: 'var(--tag-orange-text)' }}>Revit</span>
          <InfoIcon text={<>Кристаллы за использование Revit-плагинов.<br /><br /><b>Команда</b> — сумма всех участников.<br /><b>Сотрудник</b> — личный результат за месяц.</>} />
        </div>
        <div className={`${CELL} justify-center gap-1 text-[10px] font-bold`} style={HEADER_STYLE}>
          <span style={{ color: 'var(--tag-blue-text)' }}>WS</span>
          <InfoIcon text={<>Кристаллы за ведение задач в Worksection.<br /><br /><b>Команда</b> — сумма всех участников.<br /><b>Сотрудник</b> — личный результат за месяц.</>} />
        </div>
        <div className={`${CELL} gap-1 text-[10px] font-bold`} style={HEADER_STYLE}>
          <span style={{ color: 'var(--tag-purple-text)' }}>Достижения</span>
          <InfoIcon text={<><b>Команда</b> — разбивка полученных наград: личные и командные.<br /><br /><b>Сотрудник</b> — прогресс-бейджи по Revit, WS и Благодарностям. Наведи на бейдж для деталей.</>} />
        </div>
        <div className={`${CELL} gap-1 text-[10px] font-bold`} style={HEADER_STYLE}>
          <span style={{ color: 'var(--tag-purple-text)' }}>Благодарности</span>
          <InfoIcon text={<>Благодарности, полученные от коллег за месяц.<br /><br /><b>Команда</b> — общее количество.<br /><b>Сотрудник</b> — категории, за которые его благодарили.</>} />
        </div>

        {/* Строка команды */}
        <div className={`${CELL} gap-1.5`} style={ROW_STYLE}>
          <Users size={12} style={{ color: 'var(--apex-primary)', flexShrink: 0 }} />
          <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: 'var(--apex-primary)' }}>
            {data.team}
            <span className="ml-1 text-[11px] font-medium opacity-50">({data.members.length})</span>
          </span>
        </div>
        <div className={`${CELL} justify-center`} style={{ ...ROW_STYLE, ...COIN_GAP }}>
          <CoinCell value={data.revitCoins} color="var(--tag-orange-text)" bg="var(--tag-orange-bg)" />
        </div>
        <div className={`${CELL} justify-center`} style={ROW_STYLE}>
          <CoinCell value={data.wsCoins} color="var(--tag-blue-text)" bg="var(--tag-blue-bg)" />
        </div>
        <div className={CELL} style={ROW_STYLE}>
          <AchBreakdownCell b={data.achBreakdown} />
        </div>
        <div className={CELL} style={ROW_STYLE}>
          <CountBadge icon={Handshake} value={data.gratitudesCount} color="var(--tag-teal-text)" bg="var(--tag-teal-bg)" />
        </div>

        {/* Сотрудники */}
        {data.members.map((person, idx) => {
          const isLast = idx === data.members.length - 1
          const style = { background: 'var(--surface-elevated)', borderBottom: isLast ? 'none' : '1px solid var(--border)' }
          return (
            <Fragment key={person.userId}>
              <div className={`${CELL} pl-9`} style={style}>
                <span className="text-[12px] font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
                  {person.name}
                </span>
              </div>
              <div className={`${CELL} justify-center`} style={{ ...style, ...COIN_GAP }}>
                <CoinCell value={person.revitCoins} color="var(--tag-orange-text)" bg="var(--tag-orange-bg)" />
              </div>
              <div className={`${CELL} justify-center`} style={style}>
                <CoinCell value={person.wsCoins} color="var(--tag-blue-text)" bg="var(--tag-blue-bg)" />
              </div>
              <div className={CELL} style={style}>
                <AchBadges badges={person.achievements} />
              </div>
              <div className={CELL} style={style}>
                <GratBadges items={person.gratitudes} />
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
