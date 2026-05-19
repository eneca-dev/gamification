'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Building2, Users, Handshake } from 'lucide-react'

import { AchBadges, AchBreakdownCell, CoinCell, CountBadge, GratBadges, InfoIcon } from './FeedBadges'
import { CELL, COIN_GAP, HEADER_STYLE, PERSON_STYLE, ROW_STYLE } from './feed-table-styles'
import type { DepartmentFeedData, TeamFeedRow } from '../types'


// ── Секция команды ────────────────────────────────────────────────────────────

function TeamSection({ team, defaultExpanded, isLast }: {
  team: TeamFeedRow; defaultExpanded: boolean; isLast: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const toggle = () => setExpanded(v => !v)

  const teamRowStyle = {
    background: 'var(--surface-elevated)',
    borderBottom: expanded || !isLast ? '1px solid var(--border)' : 'none',
    cursor: 'pointer' as const,
  }

  return (
    <>
      {/* Строка команды — 5 ячеек */}
      <div className={`${CELL} gap-1.5 hover:opacity-80 transition-opacity select-none`} style={teamRowStyle} onClick={toggle}>
        <span style={{ color: 'var(--apex-primary)', flexShrink: 0 }}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <Users size={12} style={{ color: 'var(--apex-primary)', flexShrink: 0 }} />
        <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: 'var(--apex-primary)' }}>
          {team.team}
          <span className="ml-1 text-[11px] font-medium opacity-50">({team.members.length})</span>
        </span>
      </div>
      <div className={CELL} style={{ ...teamRowStyle, ...COIN_GAP, justifyContent: 'center' }} onClick={toggle}>
        <CoinCell value={team.revitCoins} color="var(--tag-orange-text)" bg="var(--tag-orange-bg)" />
      </div>
      <div className={CELL} style={{ ...teamRowStyle, justifyContent: 'center' }} onClick={toggle}>
        <CoinCell value={team.wsCoins} color="var(--tag-blue-text)" bg="var(--tag-blue-bg)" />
      </div>
      <div className={CELL} style={teamRowStyle} onClick={toggle}>
        <AchBreakdownCell b={team.achBreakdown} />
      </div>
      <div className={CELL} style={teamRowStyle} onClick={toggle}>
        <CountBadge icon={Handshake} value={team.gratitudesCount} color="var(--tag-teal-text)" bg="var(--tag-teal-bg)" />
      </div>

      {/* Строки сотрудников */}
      {expanded && team.members.map((person, idx) => {
        const personIsLast = isLast && idx === team.members.length - 1
        const style = { ...PERSON_STYLE, borderBottom: personIsLast ? 'none' : '1px solid var(--border)' }
        return (
          <Fragment key={person.userId}>
            <div className={`${CELL} pl-9`} style={style}>
              <span className="text-[12px] font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
                {person.name}
              </span>
            </div>
            <div className={CELL} style={{ ...style, ...COIN_GAP, justifyContent: 'center' }}>
              <CoinCell value={person.revitCoins} color="var(--tag-orange-text)" bg="var(--tag-orange-bg)" />
            </div>
            <div className={CELL} style={{ ...style, justifyContent: 'center' }}>
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
    </>
  )
}

// ── Основной компонент ────────────────────────────────────────────────────────

interface DepartmentFeedTableProps {
  data: DepartmentFeedData
  monthLabel: string
}

export function DepartmentFeedTable({ data, monthLabel }: DepartmentFeedTableProps) {
  const totalPersons = data.teams.reduce((s, t) => s + t.members.length, 0)

  if (data.teams.length === 0) {
    return (
      <div className="rounded-2xl py-10 text-center" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
        <div className="text-2xl mb-2">🏢</div>
        <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Нет данных по отделу</div>
        <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Сотрудники не найдены</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div
        data-onboarding="dept-feed-table"
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
          <InfoIcon text={<>Кристаллы за использование Revit-плагинов.<br /><br /><b>Отдел / команда</b> — сумма всех участников.<br /><b>Сотрудник</b> — личный результат за месяц.</>} />
        </div>
        <div className={`${CELL} justify-center gap-1 text-[10px] font-bold`} style={HEADER_STYLE}>
          <span style={{ color: 'var(--tag-blue-text)' }}>WS</span>
          <InfoIcon text={<>Кристаллы за ведение задач в Worksection.<br /><br /><b>Отдел / команда</b> — сумма всех участников.<br /><b>Сотрудник</b> — личный результат за месяц.</>} />
        </div>
        <div className={`${CELL} gap-1 text-[10px] font-bold`} style={HEADER_STYLE}>
          <span style={{ color: 'var(--tag-purple-text)' }}>Достижения</span>
          <InfoIcon text={<><b>Отдел / команда</b> — разбивка полученных наград: личные, командные, отдела.<br /><br /><b>Сотрудник</b> — прогресс-бейджи по Revit, WS и Благодарностям. Наведи на бейдж для деталей.</>} />
        </div>
        <div className={`${CELL} gap-1 text-[10px] font-bold`} style={HEADER_STYLE}>
          <span style={{ color: 'var(--tag-purple-text)' }}>Благодарности</span>
          <InfoIcon text={<>Благодарности, полученные от коллег за месяц.<br /><br /><b>Отдел / команда</b> — общее количество.<br /><b>Сотрудник</b> — категории, за которые его благодарили.</>} />
        </div>

        {/* Строка отдела */}
        <div className={`${CELL} gap-1.5`} style={ROW_STYLE}>
          <Building2 size={14} style={{ color: 'var(--apex-primary)', flexShrink: 0 }} />
          <div>
            <div className="text-[13px] font-extrabold whitespace-nowrap" style={{ color: 'var(--apex-primary)' }}>
              {data.department}
            </div>
            <div className="text-[10px] font-medium opacity-55 whitespace-nowrap" style={{ color: 'var(--apex-primary)' }}>
              {totalPersons} сотр. · {monthLabel}
            </div>
          </div>
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

        {/* Команды */}
        {data.teams.map((team, idx) => (
          <TeamSection
            key={team.team}
            team={team}
            defaultExpanded={data.teams.length <= 4}
            isLast={idx === data.teams.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
