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
  return (
    <div
      className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold shrink-0"
      style={{
        background:
          rank === 1
            ? "linear-gradient(135deg, var(--orange-400), var(--orange-500))"
            : rank === 2
              ? "linear-gradient(135deg, #bdbdbd, #9e9e9e)"
              : rank === 3
                ? "linear-gradient(135deg, #bcaaa4, #a1887f)"
                : "var(--surface)",
        color: rank <= 3 ? "white" : "var(--text-muted)",
        border: rank > 3 ? "1px solid var(--border)" : "none",
      }}
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
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <div
          className="text-[12px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((entry, idx) => {
          const rank = idx + 1;
          const isFirst = rank === 1;

          return (
            <div
              key={entry.name}
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
              <RankBadge rank={rank} />

              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: entry.avatarColor }}
              >
                {entry.avatar}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[12px] font-bold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {entry.name}
                  </span>
                  {entry.isCurrentUser && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: "var(--green-100)",
                        color: "var(--green-700)",
                      }}
                    >
                      Вы
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div
                  className="text-[14px] font-extrabold"
                  style={{ color: accentColor }}
                >
                  {entry.value.toLocaleString("ru-RU")}
                </div>
                <div
                  className="text-[9px] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  {unit}
                </div>
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
        accentColor="var(--green-700)"
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
