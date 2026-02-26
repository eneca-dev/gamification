"use client";

import { Crown } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/data";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <div
      className="rounded-2xl p-5 h-full"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Crown size={14} style={{ color: "var(--orange-500)" }} />
        <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Топ-5 за месяц
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => {
          const isFirst = entry.rank === 1;

          return (
            <div
              key={entry.rank}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
              style={{
                background: entry.isCurrentUser
                  ? "linear-gradient(135deg, var(--green-50), rgba(76,175,80,0.03))"
                  : isFirst
                    ? "linear-gradient(135deg, rgba(255,152,0,0.04), rgba(255,167,38,0.02))"
                    : "transparent",
                border: entry.isCurrentUser
                  ? "1px solid var(--green-200)"
                  : isFirst
                    ? "1px solid rgba(255,152,0,0.1)"
                    : "1px solid transparent",
              }}
            >
              {/* Rank */}
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
                style={{
                  background: isFirst
                    ? "linear-gradient(135deg, var(--orange-400), var(--orange-500))"
                    : entry.rank === 2
                      ? "linear-gradient(135deg, #bdbdbd, #9e9e9e)"
                      : entry.rank === 3
                        ? "linear-gradient(135deg, #bcaaa4, #a1887f)"
                        : "var(--surface)",
                  color: entry.rank <= 3 ? "white" : "var(--text-muted)",
                  border: entry.rank > 3 ? "1px solid var(--border)" : "none",
                }}
              >
                {entry.rank}
              </div>

              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{ background: entry.avatarColor }}
              >
                {entry.avatar}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[13px] font-bold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {entry.name}
                  </span>
                  {entry.isCurrentUser && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "var(--green-100)", color: "var(--green-700)" }}
                    >
                      Вы
                    </span>
                  )}
                </div>
                {/* Breakdown bar */}
                <div className="flex gap-0.5 mt-1 h-1 rounded-full overflow-hidden w-full">
                  <div
                    className="h-full rounded-l-full"
                    style={{
                      width: `${(entry.breakdown.worksection / entry.totalCoins) * 100}%`,
                      background: "#1976d2",
                    }}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${(entry.breakdown.revit / entry.totalCoins) * 100}%`,
                      background: "var(--orange-500)",
                    }}
                  />
                  <div
                    className="h-full rounded-r-full"
                    style={{
                      width: `${(entry.breakdown.social / entry.totalCoins) * 100}%`,
                      background: "#7b1fa2",
                    }}
                  />
                </div>
              </div>

              {/* Total */}
              <div className="text-right flex-shrink-0">
                <div className="text-[14px] font-extrabold" style={{ color: "var(--green-700)" }}>
                  {entry.totalCoins.toLocaleString("ru-RU")}
                </div>
                <div className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>
                  ПК
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ background: "#1976d2" }} />
          <span className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>WS</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ background: "var(--orange-500)" }} />
          <span className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>Revit</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ background: "#7b1fa2" }} />
          <span className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>Соц.</span>
        </div>
      </div>
    </div>
  );
}
