import { Suspense } from 'react'
import Link from 'next/link'
import { Trophy, Heart, Handshake } from 'lucide-react'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCompanyAwards } from '@/modules/achievements'
import { getCompanyGratitudes } from '@/modules/gratitudes'
import { AwardsFilters } from '@/modules/achievements/index.client'
import { CompanyGratitudeList } from '@/modules/gratitudes/index.client'
import { getCurrentUser } from '@/modules/auth/queries'
import { getDepartmentFeedData, getTeamFeedData } from '@/modules/feed'
import { DepartmentFeedTable, FeedTabSwitcher, TeamFeedTable } from '@/modules/feed/index.client'

async function resolveWsUserContext(
  wsUserId: string | null,
): Promise<{ department: string | null; team: string | null }> {
  if (!wsUserId) return { department: null, team: null }
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('ws_users')
    .select('department_code, team')
    .eq('id', wsUserId)
    .maybeSingle()
  return { department: data?.department_code ?? null, team: data?.team ?? null }
}

function getCurrentMonthRange(): { start: string; end: string; label: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
  const label = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  return { start, end, label }
}

function getTwoWeeksAgoISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - 14)
  return d.toISOString()
}

interface ActivityPageProps {
  searchParams: Promise<{ feed?: string }>
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const { feed } = await searchParams
  const tab = feed === 'dept' || feed === 'team' ? feed : 'company'

  const monthRange = getCurrentMonthRange()
  const user = await getCurrentUser()

  // Берём department_code и team из ws_users — это единственный авторитетный источник,
  // совпадающий со значениями в ranking-вьюхах и ach_awards
  const wsCtx = await resolveWsUserContext(user?.wsUserId ?? null)
  const department = wsCtx.department
  const team = wsCtx.team

  const hasDepartment = Boolean(department)
  // Показываем вкладку команды всем, у кого есть отдел — даже без команды (покажем «Вне команд»)
  const hasTeam = Boolean(department)

  // ── Данные для вкладки отдела ────────────────────────────────────────────
  if (tab === 'dept') {
    if (!department) {
      return (
        <div className="space-y-6">
          <Header hasDepartment={false} hasTeam={hasTeam} tab={tab} />
          <EmptyProfile message="Отдел не указан в вашем профиле" />
        </div>
      )
    }

    const deptData = await getDepartmentFeedData(
      department,
      monthRange.start,
      monthRange.end,
    )

    return (
      <div className="space-y-6">
        <Header hasDepartment={hasDepartment} hasTeam={hasTeam} tab={tab} />
        <div className="animate-fade-in-up stagger-1">
          <DepartmentFeedTable data={deptData} monthLabel={monthRange.label} />
        </div>
        <FeedSection
          title={`Достижения отдела за ${monthRange.label}`}
          icon={<Trophy size={14} style={{ color: 'var(--tag-orange-text)' }} />}
        >
          {deptData.awards.length === 0 ? (
            <EmptyFeed emoji="🏆" text="Нет достижений" subtitle="Достижения появятся здесь, когда отдел проведёт достаточно дней в топе" />
          ) : (
            <AwardsFilters
              awards={deptData.awards.filter((a) => a.entity_type === 'department' || a.entity_type === 'user')}
              hideMonthGroups
              allowedEntityTypes={['department', 'user']}
              defaultEntityType="department"
              limit={20}
            />
          )}
        </FeedSection>
        <FeedSection
          title={`Благодарности отдела за ${monthRange.label}`}
          icon={<Handshake size={14} style={{ color: 'var(--tag-teal-text)' }} />}
        >
          {deptData.feedGratitudes.length === 0 ? (
            <EmptyFeed emoji="🤝" text="Нет благодарностей" subtitle="Благодарности появятся здесь, когда кто-то из коллег отправит благодарность" />
          ) : (
            <CompanyGratitudeList items={deptData.feedGratitudes} pageSize={20} />
          )}
        </FeedSection>
      </div>
    )
  }

  // ── Данные для вкладки команды ───────────────────────────────────────────
  if (tab === 'team') {
    if (!department) {
      return (
        <div className="space-y-6">
          <Header hasDepartment={hasDepartment} hasTeam={false} tab={tab} />
          <EmptyProfile message="Отдел не указан в вашем профиле" />
        </div>
      )
    }

    const teamData = await getTeamFeedData(
      team || null,   // '' и null оба → null → «Вне команд»
      department,
      monthRange.start,
      monthRange.end,
    )

    return (
      <div className="space-y-6">
        <Header hasDepartment={hasDepartment} hasTeam={hasTeam} tab={tab} />
        <div className="animate-fade-in-up stagger-1">
          <TeamFeedTable data={teamData} monthLabel={monthRange.label} />
        </div>
        <FeedSection
          title={`Достижения команды за ${monthRange.label}`}
          icon={<Trophy size={14} style={{ color: 'var(--tag-orange-text)' }} />}
        >
          {teamData.awards.length === 0 ? (
            <EmptyFeed emoji="🏆" text="Нет достижений" subtitle="Достижения появятся здесь, когда команда проведёт достаточно дней в топе" />
          ) : (
            <AwardsFilters
              awards={teamData.awards.filter((a) => a.entity_type === 'team' || a.entity_type === 'user')}
              hideMonthGroups
              allowedEntityTypes={['team', 'user']}
              defaultEntityType="team"
              limit={20}
            />
          )}
        </FeedSection>
        <FeedSection
          title={`Благодарности команды за ${monthRange.label}`}
          icon={<Handshake size={14} style={{ color: 'var(--tag-teal-text)' }} />}
        >
          {teamData.feedGratitudes.length === 0 ? (
            <EmptyFeed emoji="🤝" text="Нет благодарностей" subtitle="Благодарности появятся здесь, когда кто-то из коллег отправит благодарность" />
          ) : (
            <CompanyGratitudeList items={teamData.feedGratitudes} pageSize={20} />
          )}
        </FeedSection>
      </div>
    )
  }

  // ── Лента компании (default) ─────────────────────────────────────────────
  const [awards, gratitudes] = await Promise.all([
    getCompanyAwards(monthRange.start, monthRange.end),
    getCompanyGratitudes(getTwoWeeksAgoISO(), 100),
  ])

  return (
    <div className="space-y-6">
      <Header hasDepartment={hasDepartment} hasTeam={hasTeam} tab={tab} />

      {/* Статистика */}
      <div className="animate-fade-in-up stagger-1 grid grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--apex-success-bg)' }}
            >
              <Trophy size={18} style={{ color: 'var(--apex-primary)' }} />
            </div>
            <div>
              <div className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {awards.length}
              </div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                Достижений за месяц
              </div>
            </div>
          </div>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--tag-purple-bg)' }}
            >
              <Heart size={18} style={{ color: 'var(--tag-purple-text)' }} />
            </div>
            <div>
              <div className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {gratitudes.length}
              </div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                Благодарностей за 2 недели
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Достижения */}
      <div className="animate-fade-in-up stagger-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={14} style={{ color: 'var(--tag-orange-text)' }} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Достижения за {monthRange.label}
            </span>
          </div>
          <Link
            href="/activity/achievements"
            className="text-[12px] font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--apex-primary)' }}
          >
            Все достижения →
          </Link>
        </div>

        {awards.length === 0 ? (
          <div
            className="rounded-2xl py-8 text-center"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="text-3xl mb-3">🏆</div>
            <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Пока никто не получил достижение
            </div>
            <div className="text-[12px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
              Достижения появятся здесь, когда кто-то проведёт достаточно дней в топе
            </div>
          </div>
        ) : (
          <AwardsFilters awards={awards} hideMonthGroups limit={20} />
        )}
      </div>

      {/* Благодарности */}
      <div className="animate-fade-in-up stagger-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Heart size={14} style={{ color: 'var(--tag-purple-text)' }} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Благодарности за 2 недели
            </span>
          </div>
          <Link
            href="/activity/gratitudes"
            className="text-[12px] font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--apex-primary)' }}
          >
            Все благодарности →
          </Link>
        </div>

        <CompanyGratitudeList items={gratitudes} pageSize={20} />
      </div>
    </div>
  )
}

// ── Вспомогательные серверные компоненты ─────────────────────────────────────

const TAB_TITLES: Record<string, string> = {
  company: 'Лента компании',
  dept: 'Лента отдела',
  team: 'Лента команды',
}

function Header({
  hasDepartment,
  hasTeam,
  tab,
}: {
  hasDepartment: boolean
  hasTeam: boolean
  tab: string
}) {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-extrabold shrink-0" style={{ color: 'var(--text-primary)' }}>
          {TAB_TITLES[tab] ?? 'Лента компании'}
        </h1>
        <Suspense fallback={null}>
          <FeedTabSwitcher hasDepartment={hasDepartment} hasTeam={hasTeam} />
        </Suspense>
      </div>
      <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
        Что происходит в компании, отделе и команде
      </p>
    </div>
  )
}

function EmptyProfile({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl py-12 text-center"
      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="text-3xl mb-3">👤</div>
      <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
        {message}
      </div>
      <div className="text-[12px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
        Обратитесь к администратору для настройки профиля
      </div>
    </div>
  )
}

function FeedSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function EmptyFeed({ emoji = '💬', text, subtitle }: { emoji?: string; text: string; subtitle?: string }) {
  return (
    <div className="py-8 text-center">
      <div className="text-3xl mb-3">{emoji}</div>
      <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{text}</div>
      {subtitle && (
        <div className="text-[12px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>
      )}
    </div>
  )
}
