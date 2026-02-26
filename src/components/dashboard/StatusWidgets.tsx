"use client";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-2.5 rounded-full" style={{ background: "var(--green-100)" }}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${percent}%`, background: "var(--green-500)" }}
      />
    </div>
  );
}

interface StatusWidgetsProps {
  goal: {
    productName: string;
    productEmoji: string;
    targetPrice: number;
    currentBalance: number;
  };
}

export function StatusWidgets({ goal }: StatusWidgetsProps) {
  const goalProgress = (goal.currentBalance / goal.targetPrice) * 100;
  const remaining = goal.targetPrice - goal.currentBalance;

  return (
    <div
      className="animate-fade-in-up stagger-1 rounded-2xl p-5 card-hover h-full"
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
  );
}
