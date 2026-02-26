"use client";

interface CircularProgressProps {
  percent: number;
}

function CircularProgress({ percent }: CircularProgressProps) {
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

interface StatusWidgetsProps {
  worksection: {
    percent: number;
    label: string;
    description: string;
  };
  activity: {
    revitAutomations: { used: number; total: number };
    gratitudes: { sent: number; total: number };
  };
  goal: {
    productName: string;
    productEmoji: string;
    targetPrice: number;
    currentBalance: number;
  };
  weekStreak: number;
}

export function StatusWidgets({ worksection, activity, goal, weekStreak }: StatusWidgetsProps) {
  const goalProgress = (goal.currentBalance / goal.targetPrice) * 100;
  const remaining = goal.targetPrice - goal.currentBalance;

  return (
    <>
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
          <CircularProgress percent={worksection.percent} />
          <div
            className="mt-3 px-3 py-1 rounded-full text-[12px] font-bold"
            style={{
              background: "var(--green-100)",
              color: "var(--green-700)",
            }}
          >
            {worksection.label}
          </div>
          <p className="text-[12px] font-medium text-center mt-2" style={{ color: "var(--text-secondary)" }}>
            {worksection.description}
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
                {activity.revitAutomations.used}/{activity.revitAutomations.total}
              </span>
            </div>
            <ProgressBar
              value={activity.revitAutomations.used}
              max={activity.revitAutomations.total}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Благодарности
              </span>
              <span className="text-[12px] font-bold" style={{ color: "var(--green-600)" }}>
                {activity.gratitudes.sent}/{activity.gratitudes.total}
              </span>
            </div>
            <ProgressBar
              value={activity.gratitudes.sent}
              max={activity.gratitudes.total}
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
                  Серия: {weekStreak} недели
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
            {goal.productEmoji}
          </div>
          <h3 className="text-[14px] font-bold text-center" style={{ color: "var(--text-primary)" }}>
            {goal.productName}
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
            <ProgressBar value={goal.currentBalance} max={goal.targetPrice} />
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
    </>
  );
}
