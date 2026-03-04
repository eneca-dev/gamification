"use client";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-2.5 rounded-full" style={{ background: "var(--teal-100)" }}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${percent}%`, background: "var(--apex-primary)" }}
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
        background: "var(--apex-surface)",
        border: "1px solid var(--apex-border)",
      }}
    >
      <div
        className="text-[12px] font-semibold uppercase tracking-wider mb-4"
        style={{ color: "var(--apex-text-muted)" }}
      >
        Моя цель
      </div>
      <div className="flex flex-col items-center">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-3"
          style={{
            background: "var(--apex-success-bg)",
            border: "1px solid var(--apex-border)",
          }}
        >
          {goal.productEmoji}
        </div>
        <h3 className="text-[14px] font-semibold text-center" style={{ color: "var(--apex-text)" }}>
          {goal.productName}
        </h3>
        <div className="w-full mt-4">
          <div className="flex justify-between mb-1.5">
            <span className="text-[11px] font-medium" style={{ color: "var(--apex-text-secondary)" }}>
              Накоплено
            </span>
            <span className="text-[11px] font-semibold" style={{ color: "var(--apex-primary)" }}>
              {Math.round(goalProgress)}%
            </span>
          </div>
          <ProgressBar value={goal.currentBalance} max={goal.targetPrice} />
          <div className="text-center mt-3">
            <span className="text-[12px]" style={{ color: "var(--apex-text-secondary)" }}>
              Осталось накопить:{" "}
            </span>
            <span className="text-[13px] font-bold" style={{ color: "var(--apex-primary)" }}>
              {remaining.toLocaleString("ru-RU")} баллов
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
