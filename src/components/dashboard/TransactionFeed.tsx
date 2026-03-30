"use client";

import type { Transaction } from "@/lib/data";

interface TransactionFeedProps {
  transactions: Transaction[];
}

export function TransactionFeed({ transactions }: TransactionFeedProps) {
  return (
    <div
      className="rounded-2xl p-5 h-full"
      style={{
        background: "var(--apex-surface)",
        border: "1px solid var(--apex-border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--apex-text-muted)" }}>
          Последние операции
        </div>
        <a href="/transactions" className="text-[12px] font-semibold" style={{ color: "var(--apex-primary)" }}>
          Все операции →
        </a>
      </div>

      <div className="space-y-1.5">
        {transactions.map((tx) => {
          const isPenalty = tx.category.includes("penalty");
          const isPurchase = tx.category === "purchase";

          let amountColor = "var(--apex-primary)";
          if (isPenalty) amountColor = "var(--apex-danger)";
          else if (isPurchase || tx.amount < 0) amountColor = "var(--apex-text-secondary)";

          const iconBg = isPenalty ? "var(--apex-error-bg)" : "var(--apex-bg)";
          const iconBorder = isPenalty
            ? `1px solid rgba(var(--apex-danger-rgb), 0.12)`
            : "1px solid var(--apex-border)";

          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
              style={{ cursor: "default" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: iconBg, border: iconBorder }}
              >
                {tx.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div>
                  <span className="text-[13px] font-semibold truncate block" style={{ color: "var(--apex-text)" }}>
                    {tx.description}
                  </span>
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--apex-text-muted)" }}>
                  {tx.date}
                </div>
              </div>
              <div className="text-[14px] font-bold flex-shrink-0" style={{ color: amountColor }}>
                {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("ru-RU")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
