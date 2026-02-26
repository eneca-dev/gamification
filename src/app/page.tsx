"use client";

import { GreetingBanner } from "@/components/dashboard/GreetingBanner";
import { AlertsBanner } from "@/components/dashboard/AlertsBanner";
import { StatusWidgets } from "@/components/dashboard/StatusWidgets";
import { StreakPanel } from "@/components/dashboard/StreakPanel";
import { DailyQuests } from "@/components/dashboard/DailyQuests";
import { TransactionFeed } from "@/components/dashboard/TransactionFeed";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import {
  user,
  wsAlerts,
  worksectionStatus,
  weeklyActivity,
  userGoal,
  revitStreak,
  worksectionStreak,
  dailyTasks,
  recentTransactions,
  leaderboard,
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

      {/* Блок 3 — Сводка: дисциплина + активность + цель */}
      <div className="grid grid-cols-3 gap-5">
        <StatusWidgets
          worksection={worksectionStatus}
          activity={weeklyActivity}
          goal={userGoal}
          weekStreak={user.weekStreak}
        />
      </div>

      {/* Блок 4 — Стрики: Revit (компактный) + WS (грид) */}
      <div className="grid grid-cols-2 gap-5 animate-fade-in-up stagger-3">
        <StreakPanel
          revitStreak={revitStreak}
          worksectionStreak={worksectionStreak}
        />
      </div>

      {/* Блок 5 — Ежедневные задания */}
      <div className="animate-fade-in-up stagger-4">
        <DailyQuests tasks={dailyTasks} />
      </div>

      {/* Блок 6 + 7 — Транзакции и Лидерборд */}
      <div className="grid grid-cols-5 gap-5 animate-fade-in-up stagger-5">
        <div className="col-span-3">
          <TransactionFeed transactions={recentTransactions} />
        </div>
        <div className="col-span-2">
          <Leaderboard entries={leaderboard} />
        </div>
      </div>
    </div>
  );
}
