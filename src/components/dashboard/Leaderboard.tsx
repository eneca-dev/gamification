"use client";

import { Crown, Zap } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/data";
import type { AutomationLeaderboardEntry } from "@/modules/plugin-stats";

// ─── Внутренний тип для рендеринга строки панели ──────────────────────────────
interface PanelEntry {
  name: string;
  avatar: string;
  avatarColor: string;
  value: number;
  isCurrentUser: boolean;
}

const AVATAR_COLORS = [
  "#607d8b", "#2196f3", "#e91e63", "#9c27b0",
  "#ff9800", "#4caf50", "#00bcd4", "#795548",
];

function emailToColor(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (h << 5) - h + email.charCodeAt(i);
    h |= 0;
  }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Компоненты ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const bg =
    rank === 1 ? "var(--rank-gold)"
    : rank === 2 ? "var(--rank-silver)"
    : rank === 3 ? "var(--rank-bronze)"
    : "var(--apex-bg)";
  const color = rank <= 3 ? "white" : "var(--apex-text-muted)";
  const border = rank > 3 ? "1px solid var(--apex-border)" : "none";

  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
      style={{ background: bg, color, border }}
    >
      {rank}
    </div>
  );
}

function TopFivePanel({
  title,
  icon,
  entries,
  accentColor,
  unit = "б",
}: {
  title: string;
  icon: React.ReactNode;
  entries: PanelEntry[];
  accentColor: string;
  unit?: string;
}) {
  const sorted = [...entries].sort((a, b) => b.value - a.value).slice(0, 5);

  return (
    <div
      className="rounded-2xl p-5 h-full"
      style={{
        background: "var(--apex-surface)",
        border: "1px solid var(--apex-border)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--apex-text-muted)" }}>
          {title}
        </div>
      </div>

      <div className="space-y-1.5">
        {sorted.map((entry, idx) => {
          const rank = idx + 1;

          return (
            <div
              key={entry.name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{
                background: entry.isCurrentUser
                  ? "var(--apex-success-bg)"
                  : rank === 1
                    ? "var(--orange-50)"
                    : "transparent",
                border: entry.isCurrentUser
                  ? `1px solid rgba(var(--apex-primary-rgb), 0.15)`
                  : rank === 1
                    ? `1px solid rgba(var(--orange-500-rgb), 0.15)`
                    : "1px solid transparent",
              }}
            >
              <RankBadge rank={rank} />

              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: entry.avatarColor }}
              >
                {entry.avatar}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold truncate" style={{ color: "var(--apex-text)" }}>
                    {entry.name}
                  </span>
                  {entry.isCurrentUser && (
                    <span
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: "var(--apex-success-bg)",
                        color: "var(--apex-primary)",
                        border: `1px solid rgba(var(--apex-primary-rgb), 0.2)`,
                      }}
                    >
                      Вы
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[14px] font-bold" style={{ color: accentColor }}>
                  {entry.value.toLocaleString("ru-RU")}
                </div>
                <div className="text-[9px]" style={{ color: "var(--apex-text-muted)" }}>{unit}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Публичный компонент ──────────────────────────────────────────────────────

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  automationEntries?: AutomationLeaderboardEntry[];
}

export function Leaderboard({ entries, automationEntries }: LeaderboardProps) {
  const generalPanel: PanelEntry[] = entries.map((e) => ({
    name: e.name,
    avatar: e.avatar,
    avatarColor: e.avatarColor,
    value: e.totalCoins,
    isCurrentUser: e.isCurrentUser,
  }));

  const automationPanel: PanelEntry[] = automationEntries
    ? automationEntries.map((e) => ({
        name: e.fullName || e.email,
        avatar: getInitials(e.fullName || e.email),
        avatarColor: emailToColor(e.email),
        value: e.launchCount,
        isCurrentUser: e.isCurrentUser,
      }))
    : entries.map((e) => ({
        name: e.name,
        avatar: e.avatar,
        avatarColor: e.avatarColor,
        value: e.breakdown.revit,
        isCurrentUser: e.isCurrentUser,
      }));

  return (
    <div className="grid grid-cols-2 gap-5 h-full">
      <TopFivePanel
        title="Топ-5 Общий"
        icon={<Crown size={14} style={{ color: "var(--orange-500)" }} />}
        entries={generalPanel}
        accentColor="var(--apex-primary)"
      />
      <TopFivePanel
        title="Топ-5 Автоматизации ★"
        icon={<Zap size={14} style={{ color: "var(--orange-500)" }} />}
        entries={automationPanel}
        unit={automationEntries ? "зап." : "б"}
        accentColor="var(--orange-500)"
      />
    </div>
  );
}
