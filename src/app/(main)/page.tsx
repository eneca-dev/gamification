import { AlertsBanner } from "@/components/dashboard/AlertsBanner";
import { StreakPanel } from "@/components/dashboard/StreakPanel";
import { TransactionFeed } from "@/components/dashboard/TransactionFeed";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { DepartmentContest } from "@/components/dashboard/DepartmentContest";
import {
  wsAlerts,
  worksectionStreak,
  dailyTasks,
  leaderboard,
  departmentContest,
  daysUntilMonthEnd,
} from "@/lib/data";
import type { Transaction, DailyTask, DepartmentEntry, WorksectionDay } from "@/lib/data";
import { getCurrentUser } from "@/modules/auth/queries";
import {
  getRevitWidgetData,
  getTopAutomationUsers,
  getRevitTransactions,
  getDepartmentAutomationStats,
} from "@/modules/revit";
import { getUserGratitudes } from "@/modules/gratitudes";

const DEPT_COLORS = [
  "#e91e63", "#2196f3", "#ff9800", "#4caf50", "#9c27b0",
  "#00bcd4", "#795548", "#607d8b", "#f44336", "#3f51b5",
  "#8bc34a", "#ff5722", "#009688", "#673ab7", "#ffc107",
];

// Генерация календарных дней за последние 5 месяцев (текущий + 4 предыдущих)
function generateLast5MonthsDays(automationDates: Set<string>): WorksectionDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Начало: 1-е число (текущий месяц - 4)
  const startMonth = new Date(today.getFullYear(), today.getMonth() - 4, 1);
  // Конец: последний день текущего месяца
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const days: WorksectionDay[] = [];
  for (let d = new Date(startMonth); d <= endMonth; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isFuture = d > today;

    let status: WorksectionDay["status"];
    if (isWeekend) {
      status = "gray";
    } else if (isFuture) {
      status = "future";
    } else {
      status = "green";
    }

    days.push({
      date: dateStr,
      status,
      automation: !isWeekend && !isFuture && automationDates.has(dateStr),
    });
  }
  return days;
}

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  const userEmail = currentUser?.email ?? "";

  const [revitData, topAutomationUsers, myGratitudes, revitTransactions, automationDepts] = await Promise.all([
    userEmail
      ? getRevitWidgetData(userEmail)
      : Promise.resolve({ streak: null, activeDates: [], yesterdaySummary: { pluginCount: 0, coinsEarned: 0 } }),
    getTopAutomationUsers(10, currentUser?.email),
    userEmail ? getUserGratitudes(userEmail, 20) : Promise.resolve([]),
    userEmail ? getRevitTransactions(userEmail, 10) : Promise.resolve([]),
    getDepartmentAutomationStats(currentUser?.email),
  ]);

  // Генерируем календарь за 5 последних месяцев с реальными датами автоматизации
  const activeDateSet = new Set(revitData.activeDates);
  const calendarDays = generateLast5MonthsDays(activeDateSet);

  const automationDays = revitData.streak?.current_streak ?? 0;
  const wsStreak = {
    ...worksectionStreak,
    automationCurrentDays: automationDays,
    calendarDays,
    automationMilestones: [
      { days: 1, reward: 5, reached: automationDays >= 1 },
      { days: 7, reward: 50, reached: automationDays >= 7 },
      { days: 30, reward: 200, reached: automationDays >= 30 },
    ],
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
        <StreakPanel worksectionStreak={wsStreak} tasks={allDailyTasks} />
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
