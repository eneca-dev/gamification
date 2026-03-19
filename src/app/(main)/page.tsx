import { AlertsBanner } from "@/components/dashboard/AlertsBanner";
import { StreakPanel } from "@/components/dashboard/StreakPanel";
import { TransactionFeed } from "@/components/dashboard/TransactionFeed";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { DepartmentContest } from "@/components/dashboard/DepartmentContest";
import {
  wsAlerts,
  dailyTasks,
  leaderboard,
  departmentContest,
  daysUntilMonthEnd,
} from "@/lib/data";
import type { Transaction, DailyTask, DepartmentEntry } from "@/lib/data";
import { getCurrentUser } from "@/modules/auth/queries";
import {
  getRevitWidgetData,
  getTopAutomationUsers,
  getRevitTransactions,
  getDepartmentAutomationStats,
} from "@/modules/revit";
import {
  getStreakDayStatuses,
  getAutomationDays,
  getWsStreakData,
  getRevitStreakData,
} from "@/modules/streak-panel";
import { getUserGratitudes } from "@/modules/gratitudes";

import type { CalendarDay, CalendarDayStatus, StreakPanelData } from "@/modules/streak-panel";

const DEPT_COLORS = [
  "#e91e63", "#2196f3", "#ff9800", "#4caf50", "#9c27b0",
  "#00bcd4", "#795548", "#607d8b", "#f44336", "#3f51b5",
  "#8bc34a", "#ff5722", "#009688", "#673ab7", "#ffc107",
];

// Понедельник недели, в которую попадает дата
function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // Пн=0
  d.setDate(d.getDate() - dow);
  return d;
}

// Воскресенье недели, в которую попадает дата
function getSunday(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + (6 - dow));
  return d;
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

// Сборка календарных дней для грида
function buildCalendarDays(
  gridStartIso: string,
  gridEndIso: string,
  cycleStartIso: string | null,
  cycleEndIso: string,
  statusMap: Map<string, { status: string; absence_type: string | null; red_reasons: string[] | null }>,
  automationDates: Set<string>,
): CalendarDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: CalendarDay[] = [];
  const start = new Date(gridStartIso + "T00:00:00");
  const end = new Date(gridEndIso + "T00:00:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = toIsoDate(d);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;

    // За пределами цикла (padding)
    const beforeCycle = cycleStartIso ? dateStr < cycleStartIso : false;
    const afterCycle = dateStr > cycleEndIso;

    if (beforeCycle || afterCycle) {
      days.push({ date: dateStr, status: "out", automation: false });
      continue;
    }

    if (isWeekend) {
      days.push({
        date: dateStr,
        status: "gray",
        automation: false,
      });
      continue;
    }

    const isFuture = d > today;
    if (isFuture) {
      days.push({ date: dateStr, status: "future", automation: false });
      continue;
    }

    const row = statusMap.get(dateStr);
    if (!row) {
      // Рабочий день в прошлом, нет записи
      days.push({ date: dateStr, status: "no_data", automation: false });
      continue;
    }

    let uiStatus: CalendarDayStatus;
    let absenceType: string | null = null;
    let redReasons: string[] | null = null;

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

  // Получаем ws_user_id из ws_users по email
  let wsUserId: string | null = null;
  if (userEmail) {
    const { createSupabaseServerClient } = await import("@/config/supabase");
    const supabase = await createSupabaseServerClient();
    const { data: wsUser } = await supabase
      .from("ws_users")
      .select("id")
      .eq("email", userEmail.toLowerCase())
      .eq("is_active", true)
      .maybeSingle();
    wsUserId = wsUser?.id ?? null;
  }

  // Параллельно: данные стриков + ревит + благодарности + транзакции + отделы
  const [wsStreak, revitStreak, revitData, topAutomationUsers, myGratitudes, revitTransactions, automationDepts] =
    await Promise.all([
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
      getTopAutomationUsers(10, currentUser?.email),
      userEmail ? getUserGratitudes(userEmail, 20) : Promise.resolve([]),
      userEmail ? getRevitTransactions(userEmail, 10) : Promise.resolve([]),
      getDepartmentAutomationStats(currentUser?.email),
    ]);

  // Вычисляем границы 90-дневного цикла
  const todayIso = toIsoDate(new Date());
  let cycleStartIso: string | null = wsStreak.streakStartDate;
  let cycleEndIso: string;
  let gridStartIso: string;
  let gridEndIso: string;

  if (cycleStartIso) {
    cycleEndIso = addDays(cycleStartIso, 89);
    gridStartIso = toIsoDate(getMonday(cycleStartIso));
    gridEndIso = toIsoDate(getSunday(cycleEndIso));
  } else {
    // Стрик = 0, нет зелёного дня — показываем от текущей недели
    gridStartIso = toIsoDate(getMonday(todayIso));
    cycleEndIso = addDays(gridStartIso, 89);
    gridEndIso = toIsoDate(getSunday(cycleEndIso));
  }

  // Параллельно: статусы дней + автоматизация
  const [dayStatuses, automationDates] = await Promise.all([
    wsUserId ? getStreakDayStatuses(wsUserId, gridStartIso, gridEndIso) : Promise.resolve([]),
    userEmail ? getAutomationDays(userEmail, gridStartIso, gridEndIso) : Promise.resolve(new Set<string>()),
  ]);

  // Собираем Map статусов для быстрого доступа
  const statusMap = new Map<string, { status: string; absence_type: string | null; red_reasons: string[] | null }>();
  for (const row of dayStatuses) {
    statusMap.set(row.date, { status: row.status, absence_type: row.absence_type, red_reasons: row.red_reasons });
  }

  const calendarDays = buildCalendarDays(
    gridStartIso,
    gridEndIso,
    cycleStartIso,
    cycleEndIso,
    statusMap,
    automationDates,
  );

  const streakPanelData: StreakPanelData = {
    calendarDays,
    cycleEnd: cycleEndIso,
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
    .slice(0, 10)
    .map((item) => item.tx);

  // Соревнование отделов — автоматизация из реальных данных
  const automationDepartments: DepartmentEntry[] = automationDepts.map((d, i) => ({
    name: d.departmentCode,
    shortName: d.departmentCode,
    color: DEPT_COLORS[i % DEPT_COLORS.length],
    employeesUsing: d.employeesUsing,
    totalEmployees: d.totalEmployees,
    usagePercent: d.usagePercent,
    wsPercent: 0,
    isCurrentDepartment: d.isCurrentDepartment,
  }));

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

      <div className="grid grid-cols-5 gap-5 animate-fade-in-up stagger-3">
        <div className="col-span-2">
          <TransactionFeed transactions={allTransactions} />
        </div>
        <div className="col-span-3">
          <Leaderboard
            entries={leaderboard}
            automationEntries={topAutomationUsers.length > 0 ? topAutomationUsers : undefined}
          />
        </div>
      </div>

      <div className="animate-fade-in-up stagger-4">
        <DepartmentContest
          departments={departmentContest}
          automationDepartments={automationDepartments.length > 0 ? automationDepartments : undefined}
          daysLeft={daysUntilMonthEnd}
        />
      </div>
    </div>
  );
}
