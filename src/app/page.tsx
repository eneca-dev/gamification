"use client";

import { GreetingBanner } from "@/components/dashboard/GreetingBanner";
import { AlertsBanner } from "@/components/dashboard/AlertsBanner";
import { StatusWidgets } from "@/components/dashboard/StatusWidgets";
import { StreakPanel } from "@/components/dashboard/StreakPanel";
import { DailyQuests } from "@/components/dashboard/DailyQuests";
import { TransactionFeed } from "@/components/dashboard/TransactionFeed";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { DepartmentContest } from "@/components/dashboard/DepartmentContest";
import {
  user,
  wsAlerts,
  userGoal,
  worksectionStreak,
  dailyTasks,
  recentTransactions,
  leaderboard,
  departmentContest,
  daysUntilMonthEnd,
} from "@/lib/data";

export default function DashboardPage() {
  const hasAlerts = wsAlerts.length > 0;

  return (
    <div className="space-y-6">
      {/* Блок 1 — Приветствие + баланс */}
      <div className="animate-fade-in-up">
        <GreetingBanner user={user} />
      </div>

      {/* Блок 2 — Алерты Worksection (условный рендеринг) */}
      {hasAlerts && (
        <div className="animate-fade-in-up stagger-1">
          <AlertsBanner alerts={wsAlerts} />
        </div>
      )}

      {/* Блок 3 — Цель (1/3) + WS дисциплина-грид (2/3) */}
      <div className="grid grid-cols-3 gap-5 animate-fade-in-up stagger-2">
        <StatusWidgets goal={userGoal} />
        <div className="col-span-2">
          <StreakPanel worksectionStreak={worksectionStreak} />
        </div>
      </div>

      {/* Блок 4 — Ежедневные задания */}
      <div className="animate-fade-in-up stagger-3">
        <DailyQuests tasks={dailyTasks} />
      </div>

      {/* Блок 5 + 6 — Транзакции и Лидерборд */}
      <div className="grid grid-cols-5 gap-5 animate-fade-in-up stagger-4">
        <div className="col-span-2">
          <TransactionFeed transactions={recentTransactions} />
        </div>
        <div className="col-span-3">
          <Leaderboard entries={leaderboard} />
        </div>
      </div>

      {/* Блок 7 — Соревнование отделов */}
      <div className="animate-fade-in-up stagger-5">
        <DepartmentContest departments={departmentContest} daysLeft={daysUntilMonthEnd} />
      </div>
    </div>
  );
}
