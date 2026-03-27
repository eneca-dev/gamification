import { AlertsBanner } from "@/components/dashboard/AlertsBanner";
import { StreakPanel } from "@/components/dashboard/StreakPanel";
import { TransactionFeed } from "@/components/dashboard/TransactionFeed";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { DepartmentContest } from "@/components/dashboard/DepartmentContest";
import {
  wsAlerts,
  dailyTasks,
} from "@/lib/data";
import type { Transaction, DailyTask, DepartmentEntry } from "@/lib/data";
import { getCurrentUser } from "@/modules/auth/queries";
import {
  getRevitWidgetData,
  getRevitTransactions,
} from "@/modules/revit";
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
} from "@/modules/streak-panel";
import { getUserGratitudes } from "@/modules/gratitudes";
import type { CalendarDay, CalendarDayStatus, RedReason, StreakPanelData } from "@/modules/streak-panel";

const DEPT_COLORS = [
  "#e91e63", "#2196f3", "#ff9800", "#4caf50", "#9c27b0",
  "#00bcd4", "#795548", "#607d8b", "#f44336", "#3f51b5",
  "#8bc34a", "#ff5722", "#009688", "#673ab7", "#ffc107",
];

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Границы грида: 4 месяца по двухмесячным блокам
// Янв-Фев → Дек-Мар, Мар-Апр → Фев-Май, Май-Июн → Апр-Июл, и т.д.
function getGridRange(): { rangeStart: string; rangeEnd: string } {
  const now = new Date();
  const startMonth = Math.floor((now.getMonth()) / 2) * 2; // 0-indexed, округлён к паре
  const rangeStart = new Date(now.getFullYear(), startMonth - 1, 1);
  const rangeEnd = new Date(now.getFullYear(), startMonth + 3, 0); // последний день startMonth+2
  return { rangeStart: toIsoDate(rangeStart), rangeEnd: toIsoDate(rangeEnd) };
}

// Сборка календарных дней для грида (4 месяца)
function buildCalendarDays(
  rangeStart: string,
  rangeEnd: string,
  statusMap: Map<string, { status: string; absence_type: string | null; red_reasons: RedReason[] | null }>,
  automationDates: Set<string>,
  holidays: Set<string>,
  workdays: Set<string>,
): CalendarDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: CalendarDay[] = [];
  const start = new Date(rangeStart + "T00:00:00");
  const end = new Date(rangeEnd + "T00:00:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = toIsoDate(d);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;

    const isDayOff = (isWeekend && !workdays.has(dateStr)) || (!isWeekend && holidays.has(dateStr));
    if (isDayOff) {
      days.push({ date: dateStr, status: "gray", automation: false });
      continue;
    }

    const isFuture = d > today;
    if (isFuture) {
      days.push({ date: dateStr, status: "future", automation: false });
      continue;
    }

    const row = statusMap.get(dateStr);
    if (!row) {
      days.push({ date: dateStr, status: "no_data", automation: automationDates.has(dateStr) });
      continue;
    }

    let uiStatus: CalendarDayStatus;
    let absenceType: string | null = null;
    let redReasons: RedReason[] | null = null;

    if (row.status === "green") {
      uiStatus = "green";
    } else if (row.status === "red") {
      uiStatus = "red";
      redReasons = row.red_reasons;
    } else if (row.status === "absent") {
      uiStatus = "frozen";
      absenceType = row.absence_type;
    } else {
      uiStatus = "no_data";
    }

    days.push({
      date: dateStr,
      status: uiStatus,
      automation: automationDates.has(dateStr) && uiStatus !== "frozen",
      absenceType,
      redReasons,
    });
  }

  return days;
}

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

  // Параллельно: данные стриков + ревит + благодарности + транзакции + отделы
  const [
    wsStreak, revitStreak, revitData,
    revitPersonalRanking, wsPersonalRanking,
    revitTeamRanking, wsTeamRanking,
    revitDeptRanking, wsDeptRanking,
    myGratitudes, revitTransactions,
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
      userEmail ? getUserGratitudes(userEmail, 20) : Promise.resolve([]),
      userEmail ? getRevitTransactions(userEmail, 10) : Promise.resolve([]),
    ]);

  // Грид: 4 месяца (1 назад + текущий + 2 вперёд)
  const { rangeStart, rangeEnd } = getGridRange();

  // Параллельно: статусы дней + автоматизация + праздники
  const [dayStatuses, automationDates, holidays, workdays] = await Promise.all([
    wsUserId ? getStreakDayStatuses(wsUserId, rangeStart, rangeEnd) : Promise.resolve([]),
    userEmail ? getAutomationDays(userEmail, rangeStart, rangeEnd) : Promise.resolve(new Set<string>()),
    getHolidays(rangeStart, rangeEnd),
    getWorkdays(rangeStart, rangeEnd),
  ]);

  // Собираем Map статусов для быстрого доступа
  const statusMap = new Map<string, { status: string; absence_type: string | null; red_reasons: RedReason[] | null }>();
  for (const row of dayStatuses) {
    statusMap.set(row.date, { status: row.status, absence_type: row.absence_type, red_reasons: row.red_reasons });
  }

  const calendarDays = buildCalendarDays(rangeStart, rangeEnd, statusMap, automationDates, holidays, workdays);

  const streakPanelData: StreakPanelData = {
    calendarDays,
    completedCycles: wsStreak.completedCycles,
    ws: wsStreak,
    revit: revitStreak,
  };

  // Ежедневное задание по автоматизации
  const { pluginCount, coinsEarned } = revitData.yesterdaySummary;
  const revitDailyTask: DailyTask = {
    id: 100,
    source: "revit",
    title: pluginCount > 0
      ? "Автоматизация"
      : "Не забудьте использовать автоматизацию",
    description: pluginCount > 0
      ? `Вчера вы использовали ${pluginCount} плагинов, вам начислено ${coinsEarned} ПК`
      : "Используйте плагины Revit для начисления баллов",
    reward: coinsEarned,
    icon: "⚡",
    progress: pluginCount,
    total: Math.max(pluginCount, 1),
    completed: pluginCount > 0,
  };
  const allDailyTasks = [...dailyTasks, revitDailyTask];

  // Транзакции: благодарности + ревит, сортируем по дате
  const txItems: { sortKey: number; tx: Transaction }[] = [];

  for (const [i, g] of myGratitudes.entries()) {
    txItems.push({
      sortKey: new Date(g.airtable_created_at).getTime(),
      tx: {
        id: i + 1,
        source: "social" as const,
        category: "gratitude_received" as const,
        description: `${g.sender_name}: ${g.message.slice(0, 80)}${g.message.length > 80 ? "…" : ""}`,
        amount: g.earned_coins,
        date: new Date(g.airtable_created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
        icon: "🤝",
      },
    });
  }

  for (const [i, rt] of revitTransactions.entries()) {
    const desc = rt.pluginName
      ? `${rt.pluginName}: ${rt.launchCount ?? 1} запусков`
      : rt.description;
    txItems.push({
      sortKey: new Date(rt.createdAt).getTime(),
      tx: {
        id: 1000 + i,
        source: "revit" as const,
        category: "automation_run" as const,
        description: desc,
        amount: rt.coins,
        date: new Date(rt.eventDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
        icon: "⚡",
      },
    });
  }

  const allTransactions = txItems
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 5)
    .map((item) => item.tx);

  // Конвертируем RankingEntry[] в формат для Leaderboard
  const toLeaderboardEntries = (entries: typeof wsPersonalRanking) =>
    entries.map((r) => ({
      email: r.entity_id,
      fullName: r.label,
      totalCoins: r.score,
      launchCount: 0,
      isCurrentUser: r.entity_id === wsUserId,
    }))

  // Дней до конца месяца
  const now = new Date();
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
  const hasAlerts = wsAlerts.length > 0;

  return (
    <div className="space-y-6">
      {hasAlerts && (
        <div className="animate-fade-in-up">
          <AlertsBanner alerts={wsAlerts} />
        </div>
      )}

      <div className="animate-fade-in-up stagger-1">
        <StreakPanel streakData={streakPanelData} tasks={allDailyTasks} />
      </div>

      <div className="grid grid-cols-5 gap-5 animate-fade-in-up stagger-2">
        <div className="col-span-2">
          <TransactionFeed transactions={allTransactions} />
        </div>
        <div className="col-span-3">
          <Leaderboard
            entries={toLeaderboardEntries(wsPersonalRanking)}
            automationEntries={toLeaderboardEntries(revitPersonalRanking)}
          />
        </div>
      </div>

      <div className="animate-fade-in-up stagger-3">
        <DepartmentContest
          departments={toDeptEntries(wsDeptRanking, currentDept)}
          automationDepartments={toDeptEntries(revitDeptRanking, currentDept)}
          daysLeft={daysLeft}
          currentEntityName={wsDeptCode}
        />
      </div>

      {/* Топ команд */}
      <div className="animate-fade-in-up stagger-4">
        <DepartmentContest
          departments={toDeptEntries(wsTeamRanking, wsTeam)}
          automationDepartments={toDeptEntries(revitTeamRanking, wsTeam)}
          daysLeft={daysLeft}
          title="Соревнование команд"
          currentEntityName={wsTeam}
        />
      </div>
    </div>
  );
}
