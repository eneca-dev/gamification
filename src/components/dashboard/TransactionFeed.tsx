"use client";

import type { Transaction } from "@/lib/data";
import { sourceColors } from "@/lib/data";

interface TransactionFeedProps {
  transactions: Transaction[];
}

export function TransactionFeed({ transactions }: TransactionFeedProps) {
  return (
    <div
      className="rounded-2xl p-5 h-full"
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
      <div className="space-y-1.5">
        {transactions.map((tx) => {
          const srcColor = sourceColors[tx.source];
          const isPenalty = tx.category.includes("penalty");
          const isPurchase = tx.category === "purchase";

          let amountColor = "var(--green-600)";
          if (isPenalty) amountColor = "#e53935";
          else if (isPurchase) amountColor = "var(--text-secondary)";
          else if (tx.amount < 0) amountColor = "var(--text-secondary)";

          let bgColor = "var(--green-50)";
          if (isPenalty) bgColor = "rgba(229,57,53,0.06)";
          else if (tx.source === "revit") bgColor = "var(--orange-50)";
          else if (tx.source === "social") bgColor = "rgba(156,39,176,0.06)";

          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[rgba(76,175,80,0.03)]"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: bgColor }}
              >
                {tx.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="px-1 py-0.5 rounded text-[8px] font-bold"
                    style={{ background: srcColor.bg, color: srcColor.text }}
                  >
                    {srcColor.label}
                  </span>
                  <span className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {tx.description}
                  </span>
                </div>
                <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                  {tx.date}
                </div>
              </div>
              <div
                className="text-[14px] font-extrabold flex-shrink-0"
                style={{ color: amountColor }}
              >
                {tx.amount > 0 ? "+" : ""}
                {tx.amount.toLocaleString("ru-RU")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
