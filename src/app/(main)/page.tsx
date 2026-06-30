import { CoinIcon } from "@/components/CoinIcon";
import { AlarmsBanner } from "@/modules/alarms/components/AlarmsBanner";
import { StreakPanel } from "@/components/dashboard/StreakPanel";
import { TransactionFeed } from "@/components/dashboard/TransactionFeed";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { DepartmentContest } from "@/components/dashboard/DepartmentContest";
import type { Transaction, DepartmentEntry } from "@/lib/data";
import { getCurrentUser } from "@/modules/auth/queries";
import {
  getRevitWidgetData,
  getRevitTransactions,
} from "@/modules/revit";
import { getUserTransactions, getEventIcon, getTransactionDisplayDate } from "@/modules/transactions";
import {
  getRevitPersonalRanking,
  getRevitTeamRanking,
  getRevitDepartmentRanking,
  getWsPersonalRanking,
  getWsTeamRanking,
  getWsDepartmentRanking,
} from "@/modules/achievements";
import {
  getStreakDayStatuses,
  getAutomationDays,
  getHolidays,
  getWorkdays,
  getWsStreakData,
  getRevitStreakData,
  getGridRange,
  buildCalendarDays,
} from "@/modules/streak-panel";
import { getActiveAlarms } from "@/modules/alarms";
import { getMyGratitudesNew, getSenderQuota, getGratitudeRecipients } from "@/modules/gratitudes";
import { getUserBalance } from "@/modules/shop";
import { getUserOrders } from "@/modules/shop";
import { getPendingResets, getShieldDatesInRange } from "@/modules/streak-shield";
import { getMasterPlannerPanel } from "@/modules/master-planner";
import { MasterPlannerPanel } from "@/modules/master-planner/components/MasterPlannerPanel";
import { getContestWinners } from "@/modules/contests";
import { GratitudeWidget } from "@/modules/gratitudes/components/GratitudeWidget";
import type { RedReason, StreakPanelData } from "@/modules/streak-panel";

const DEPT_COLORS = [
  "#e91e63", "#2196f3", "#ff9800", "#4caf50", "#9c27b0",
  "#00bcd4", "#795548", "#607d8b", "#f44336", "#3f51b5",
  "#8bc34a", "#ff5722", "#009688", "#673ab7", "#ffc107",
];

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  const userEmail = currentUser?.email ?? "";
  const userId = currentUser?.id ?? "";

  // Получаем ws_user данные (id, department_code, team) для сопоставления с рейтингами
  let wsUserId: string | null = null;
  let wsDeptCode: string | null = null;
  let wsTeam: string | null = null;
  if (userEmail) {
    const { createSupabaseServerClient } = await import("@/config/supabase");
    const supabase = await createSupabaseServerClient();
    const { data: wsUser } = await supabase
      .from("ws_users")
      .select("id, department_code, team")
      .eq("email", userEmail.toLowerCase())
      .eq("is_active", true)
      .maybeSingle();
    wsUserId = wsUser?.id ?? null;
    wsDeptCode = wsUser?.department_code ?? null;
    wsTeam = wsUser?.team ?? null;
  }

  // Грид: 4 месяца (1 назад + текущий + 2 вперёд) — синхронный, вычисляем сразу
  const { rangeStart, rangeEnd } = getGridRange();

  // Все запросы параллельно в одном Promise.all (PERF-01)
  const [
    wsStreak, revitStreak, revitData,
    revitPersonalRanking, wsPersonalRanking,
    revitTeamRanking, wsTeamRanking,
    revitDeptRanking, wsDeptRanking,
    revitTransactions,
    recentTransactions,
    activeAlarms,
    senderQuota, gratitudeRecipients, userBalance, myGratitudesNew, userOrders,
    dayStatuses, automationDates, holidays, workdays, pendingResets,
    shieldDates,
    masterPlannerData,
    contestWinners,
  ] = await Promise.all([
      wsUserId ? getWsStreakData(wsUserId) : Promise.resolve({
        currentStreak: 0, longestStreak: 0, streakStartDate: null, completedCycles: 0,
        milestones: [
          { days: 7, reward: 25, reached: false },
          { days: 30, reward: 100, reached: false },
          { days: 90, reward: 300, reached: false },
        ],
      }),
      wsUserId ? getRevitStreakData(wsUserId) : Promise.resolve({
        currentStreak: 0,
        milestones: [
          { days: 7, reward: 25, reached: false },
          { days: 30, reward: 100, reached: false },
        ],
      }),
      userEmail
        ? getRevitWidgetData(userEmail)
        : Promise.resolve({ streak: null, activeDates: [], yesterdaySummary: { pluginCount: 0, coinsEarned: 0 } }),
      getRevitPersonalRanking(500),
      getWsPersonalRanking(500),
      getRevitTeamRanking(100),
      getWsTeamRanking(100),
      getRevitDepartmentRanking(50),
      getWsDepartmentRanking(50),
      userEmail ? getRevitTransactions(userEmail, 10) : Promise.resolve([]),
      userEmail ? getUserTransactions(userEmail, 5) : Promise.resolve([]),
      wsUserId ? getActiveAlarms(wsUserId) : Promise.resolve([]),
      // Благодарности
      wsUserId ? getSenderQuota(wsUserId) : Promise.resolve({ used: true, coins_per_gratitude: 0, period_start: '', period_end: '', next_quota_date: null }),
      wsUserId ? getGratitudeRecipients(wsUserId) : Promise.resolve([]),
      wsUserId ? getUserBalance(wsUserId) : Promise.resolve(0),
      userEmail ? getMyGratitudesNew(userEmail, 30) : Promise.resolve([]),
      wsUserId ? getUserOrders(wsUserId) : Promise.resolve([]),
      // Календарь
      wsUserId ? getStreakDayStatuses(wsUserId, rangeStart, rangeEnd) : Promise.resolve([]),
      userEmail ? getAutomationDays(userEmail, rangeStart, rangeEnd) : Promise.resolve(new Set<string>()),
      getHolidays(rangeStart, rangeEnd),
      getWorkdays(rangeStart, rangeEnd),
      wsUserId ? getPendingResets(wsUserId) : Promise.resolve([]),
      wsUserId ? getShieldDatesInRange(wsUserId, rangeStart, rangeEnd) : Promise.resolve(new Map<string, 'ws' | 'revit'>()),
      wsUserId ? getMasterPlannerPanel(wsUserId) : Promise.resolve(null),
      getContestWinners(1),
    ]);

  // Собираем Map статусов для быстрого доступа
  const statusMap = new Map<string, { status: string; absence_type: string | null; red_reasons: RedReason[] | null }>();
  for (const row of dayStatuses) {
    statusMap.set(row.date, { status: row.status, absence_type: row.absence_type, red_reasons: row.red_reasons });
  }

  const calendarDays = buildCalendarDays(rangeStart, rangeEnd, statusMap, automationDates, holidays, workdays, shieldDates);

  const streakPanelData: StreakPanelData = {
    calendarDays,
    completedCycles: wsStreak.completedCycles,
    ws: wsStreak,
    revit: revitStreak,
  };

  // Транзакции из view_user_transactions (все источники)
  const allTransactions: Transaction[] = recentTransactions.map((tx, i) => {
    const details = tx.details as Record<string, unknown> | null
    const plugins = tx.event_type === 'revit_using_plugins'
      ? (details?.plugins as Array<{ plugin_name: string; launch_count: number }> | undefined)
      : undefined
    return {
      id: i + 1,
      source: tx.source as Transaction["source"],
      category: "daily_green" as Transaction["category"],
      description: tx.description,
      amount: tx.coins,
      date: getTransactionDisplayDate(tx.event_type, tx.event_date, { day: "numeric", month: "short" }),
      icon: getEventIcon(tx.event_type),
      plugins,
      subItems: tx.subItems,
      inlineLink: tx.inlineLink,
    }
  });

  // Конвертируем RankingEntry[] в формат для Leaderboard
  const toLeaderboardEntries = (entries: typeof wsPersonalRanking) =>
    entries.map((r) => ({
      email: r.entity_id,
      fullName: r.label,
      totalCoins: r.score,
      launchCount: 0,
      isCurrentUser: r.entity_id === wsUserId,
    }))

  // Дней до конца месяца (по минскому времени, иначе на сервере в UTC дата сдвигается)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Minsk' }));
  const daysLeft = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());

  // Конвертируем RankingEntry[] в DepartmentEntry[]
  const toDeptEntries = (entries: typeof wsDeptRanking, currentDept: string | null): DepartmentEntry[] =>
    entries.map((r, i) => ({
      name: r.entity_id,
      shortName: r.entity_id,
      color: DEPT_COLORS[i % DEPT_COLORS.length],
      employeesUsing: parseInt(r.extra?.split('/')[0] ?? '0', 10) || 0,
      totalEmployees: parseInt(r.extra?.split('/')[1] ?? '0', 10) || 0,
      usagePercent: 0,
      totalCoins: 0,
      contestScore: r.score,
      wsPercent: 0,
      isCurrentDepartment: r.entity_id === currentDept,
    }))

  const currentDept = wsDeptCode;

  // Победители прошлого месяца
  const lastMonthDate = new Date();
  lastMonthDate.setDate(1);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthLabelStr = lastMonthDate.toLocaleString('ru-RU', { month: 'long' });

  const findWinner = (type: string) =>
    contestWinners.find((w) => w.contestType === type && w.contestMonth === lastMonthKey)?.winner ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-5 animate-fade-in-up">
        <div className="xl:shrink-0 overflow-x-auto">
          <StreakPanel streakData={streakPanelData} pendingResets={pendingResets} userBalance={userBalance} />
        </div>
        {masterPlannerData && (
          <div className="flex-1 min-w-0 grid grid-cols-1 3xl:grid-cols-5 gap-5">
            <div
              className="3xl:col-span-3 rounded-2xl p-5 animate-fade-in-up"
              data-onboarding="master-planner-panel"
              style={{
                background: "var(--apex-surface)",
                border: "1px solid var(--apex-border)",
              }}
            >
              <MasterPlannerPanel data={masterPlannerData} />
            </div>
            <div className="hidden 3xl:block 3xl:col-span-2" data-onboarding="alarms-widget">
              <AlarmsBanner alarms={activeAlarms} />
            </div>
          </div>
        )}
      </div>

      <div className="3xl:grid 3xl:grid-cols-2 3xl:gap-5 space-y-6 3xl:space-y-0">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5 animate-fade-in-up stagger-1">
          <div className="@container md:col-span-2 3xl:hidden" data-onboarding="alarms-widget">
            <AlarmsBanner alarms={activeAlarms} />
          </div>
          <div className="@container md:col-span-3 3xl:col-span-5">
            {wsUserId && (
              <GratitudeWidget
                senderId={wsUserId}
                currentUserEmail={userEmail}
                quota={senderQuota}
                recipients={gratitudeRecipients}
                balance={userBalance}
                myGratitudes={myGratitudesNew}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-5 animate-fade-in-up stagger-2">
          <div className="@container md:col-span-2">
            <TransactionFeed transactions={allTransactions} />
          </div>
          <div className="@container md:col-span-3" data-onboarding="leaderboard">
            <Leaderboard
              entries={toLeaderboardEntries(wsPersonalRanking)}
              automationEntries={toLeaderboardEntries(revitPersonalRanking)}
            />
          </div>
        </div>
      </div>

      {/* На 3xl+ блоки конкурсов рядом, на меньших — стопкой */}
      <div className="3xl:grid 3xl:grid-cols-2 3xl:gap-5 space-y-6 3xl:space-y-0">
        <div className="animate-fade-in-up stagger-3" data-onboarding="department-contest">
          <DepartmentContest
            departments={toDeptEntries(wsDeptRanking, currentDept)}
            automationDepartments={toDeptEntries(revitDeptRanking, currentDept)}
            daysLeft={daysLeft}
            currentEntityName={wsDeptCode}
            wsTooltip="Среднее количество 💎 на сотрудника отдела за Worksection. Сброс каждый месяц."
            wsTooltipFormula="Очки = сумма 💎 отдела ÷ кол-во людей в отделе"
            autoTooltip="Учитывается вовлечённость — доля людей, использующих плагины. Сброс каждый месяц."
            autoTooltipFormula={"Очки = (сумма 💎 по Revit × коэф. вовлечённости) ÷ кол-во людей в отделе\nКоэф. вовлечённости = сотрудники, использующие плагин ÷ все сотрудники отдела"}
            lastMonthWsWinner={findWinner('ws_dept')}
            lastMonthRevitWinner={findWinner('revit_dept')}
            lastMonthLabel={lastMonthLabelStr}
          />
        </div>

        <div className="animate-fade-in-up stagger-4">
          <DepartmentContest
            departments={toDeptEntries(wsTeamRanking, wsTeam)}
            automationDepartments={toDeptEntries(revitTeamRanking, wsTeam)}
            daysLeft={daysLeft}
            title="Соревнование команд"
            currentEntityName={wsTeam}
            wsTooltip="Среднее количество 💎 на сотрудника команды за Worksection. Сброс каждый месяц."
            wsTooltipFormula="Очки = сумма 💎 команды ÷ кол-во людей в команде"
            autoTooltip="Учитывается вовлечённость — доля людей, использующих плагины. Сброс каждый месяц."
            autoTooltipFormula={"Очки = (сумма 💎 по Revit × коэф. вовлечённости) ÷ кол-во людей в команде\nКоэф. вовлечённости = сотрудники, использующие плагин ÷ все сотрудники команды"}
            lastMonthWsWinner={findWinner('ws_team')}
            lastMonthRevitWinner={findWinner('revit_team')}
            lastMonthLabel={lastMonthLabelStr}
          />
        </div>
      </div>
    </div>
  );
}
