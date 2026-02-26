"use client";

import { user, worksectionStatus, weeklyActivity, userGoal, transactions, dailyQuests } from "@/lib/data";
import { CoinBalance, CoinStatic } from "@/components/CoinBalance";

function CircularProgress({ percent }: { percent: number }) {
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          stroke="var(--green-100)"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          stroke={percent === 100 ? "var(--green-500)" : "var(--orange-500)"}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: `${size / 2}px ${size / 2}px`,
            transition: "stroke-dashoffset 1.2s ease-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold" style={{ color: "var(--green-700)" }}>
          {percent}%
        </span>
        <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
          выполнено
        </span>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = "var(--green-500)" }: { value: number; max: number; color?: string }) {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-2.5 rounded-full" style={{ background: "var(--green-100)" }}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const goalProgress = (userGoal.currentBalance / userGoal.targetPrice) * 100;
  const remaining = userGoal.targetPrice - userGoal.currentBalance;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="animate-fade-in-up">
        <div
          className="rounded-2xl p-6"
          style={{
            background: "linear-gradient(135deg, rgba(76,175,80,0.06) 0%, rgba(102,187,106,0.02) 100%)",
            border: "1px solid rgba(76,175,80,0.1)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                style={{
                  background: "linear-gradient(135deg, #4CAF50, #2e7d32)",
                  boxShadow: "0 4px 12px rgba(76,175,80,0.3)",
                }}
              >
                {user.avatar}
              </div>
              <div>
                <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                  Здравствуйте, {user.name}!
                </h1>
                <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Отличный день для продуктивной работы
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[12px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                На вашем счету
              </div>
              <CoinStatic amount={user.balance} size="lg" />
              <div className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
                Проект-коинов
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Widgets grid */}
      <div className="grid grid-cols-3 gap-5">
        {/* Worksection discipline */}
        <div
          className="animate-fade-in-up stagger-1 rounded-2xl p-5 card-hover"
          style={{
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            Дисциплина Worksection
          </div>
          <div className="flex flex-col items-center">
            <CircularProgress percent={worksectionStatus.percent} />
            <div
              className="mt-3 px-3 py-1 rounded-full text-[12px] font-bold"
              style={{
                background: "var(--green-100)",
                color: "var(--green-700)",
              }}
            >
              {worksectionStatus.label}
            </div>
            <p className="text-[12px] font-medium text-center mt-2" style={{ color: "var(--text-secondary)" }}>
              {worksectionStatus.description}
            </p>
          </div>
        </div>

        {/* Weekly activity */}
        <div
          className="animate-fade-in-up stagger-2 rounded-2xl p-5 card-hover"
          style={{
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="text-[12px] font-bold uppercase tracking-wider mb-5" style={{ color: "var(--text-muted)" }}>
            Недельная активность
          </div>
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Автоматизации Revit
                </span>
                <span className="text-[12px] font-bold" style={{ color: "var(--green-600)" }}>
                  {weeklyActivity.revitAutomations.used}/{weeklyActivity.revitAutomations.total}
                </span>
              </div>
              <ProgressBar
                value={weeklyActivity.revitAutomations.used}
                max={weeklyActivity.revitAutomations.total}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Благодарности
                </span>
                <span className="text-[12px] font-bold" style={{ color: "var(--green-600)" }}>
                  {weeklyActivity.gratitudes.sent}/{weeklyActivity.gratitudes.total}
                </span>
              </div>
              <ProgressBar
                value={weeklyActivity.gratitudes.sent}
                max={weeklyActivity.gratitudes.total}
              />
            </div>

            <div
              className="rounded-xl p-3 mt-2"
              style={{
                background: "var(--green-50)",
                border: "1px solid rgba(76,175,80,0.1)",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🔥</span>
                <div>
                  <div className="text-[12px] font-bold" style={{ color: "var(--green-700)" }}>
                    Серия: {user.weekStreak} недели
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    Безупречная работа подряд
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Goal tracker */}
        <div
          className="animate-fade-in-up stagger-3 rounded-2xl p-5 card-hover"
          style={{
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            Моя цель
          </div>
          <div className="flex flex-col items-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-3"
              style={{
                background: "linear-gradient(135deg, var(--green-50), #e8f5e9)",
                border: "2px solid var(--green-100)",
              }}
            >
              {userGoal.productEmoji}
            </div>
            <h3 className="text-[14px] font-bold text-center" style={{ color: "var(--text-primary)" }}>
              {userGoal.productName}
            </h3>
            <div className="w-full mt-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Накоплено
                </span>
                <span className="text-[11px] font-bold" style={{ color: "var(--green-600)" }}>
                  {Math.round(goalProgress)}%
                </span>
              </div>
              <ProgressBar value={userGoal.currentBalance} max={userGoal.targetPrice} />
              <div className="text-center mt-3">
                <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  Осталось накопить:{" "}
                </span>
                <span className="text-[13px] font-extrabold" style={{ color: "var(--green-700)" }}>
                  {remaining.toLocaleString("ru-RU")} коинов
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily quests */}
      <div className="animate-fade-in-up stagger-4">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Ежедневные задания
              </div>
              <div
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: "linear-gradient(135deg, var(--orange-500), var(--orange-400))",
                  color: "white",
                }}
              >
                +{dailyQuests.reduce((s, q) => s + q.reward, 0)} коинов
              </div>
            </div>
            <div className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
              {dailyQuests.filter((q) => q.completed).length}/{dailyQuests.length} выполнено
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {dailyQuests.map((quest) => (
              <div
                key={quest.id}
                className="flex items-start gap-3 p-3.5 rounded-xl transition-all"
                style={{
                  background: quest.completed
                    ? "linear-gradient(135deg, var(--green-50), rgba(76,175,80,0.03))"
                    : "var(--surface)",
                  border: quest.completed
                    ? "1px solid var(--green-200)"
                    : "1px solid var(--border)",
                  opacity: quest.completed ? 0.75 : 1,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                  style={{
                    background: quest.completed ? "var(--green-100)" : "var(--surface-elevated)",
                    border: quest.completed ? "none" : "1px solid var(--border)",
                  }}
                >
                  {quest.completed ? "✅" : quest.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[13px] font-bold leading-snug"
                    style={{
                      color: quest.completed ? "var(--green-700)" : "var(--text-primary)",
                      textDecoration: quest.completed ? "line-through" : "none",
                    }}
                  >
                    {quest.title}
                  </div>
                  <div className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {quest.description}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="flex-1 h-1.5 rounded-full w-16"
                        style={{ background: "var(--green-100)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(quest.progress / quest.total) * 100}%`,
                            background: quest.completed ? "var(--green-500)" : "var(--orange-500)",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                        {quest.progress}/{quest.total}
                      </span>
                    </div>
                    <span
                      className="text-[11px] font-extrabold"
                      style={{ color: quest.completed ? "var(--green-600)" : "var(--orange-500)" }}
                    >
                      +{quest.reward}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction feed */}
      <div className="animate-fade-in-up stagger-5">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Последние операции
            </div>
            <a
              href="/achievements"
              className="text-[12px] font-semibold"
              style={{ color: "var(--green-500)" }}
            >
              Все операции →
            </a>
          </div>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[rgba(76,175,80,0.03)]"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{
                    background: tx.type === "income" ? "var(--green-50)" : "var(--orange-50)",
                  }}
                >
                  {tx.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {tx.description}
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                    {tx.date}
                  </div>
                </div>
                <div
                  className="text-[14px] font-extrabold flex-shrink-0"
                  style={{
                    color: tx.amount > 0 ? "var(--green-600)" : "#e53935",
                  }}
                >
                  {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("ru-RU")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
