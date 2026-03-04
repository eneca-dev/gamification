"use client";

import { Fragment } from "react";
import { Trophy } from "lucide-react";
import type { WorksectionStreak, StreakMilestone, WorksectionDayStatus } from "@/lib/data";

// ─── Layout constants ─────────────────────────────────────────────────────────
const CELL = 18;
const CELL_GAP = 4;
const MONTH_SEP = 12;
const DAY_LABEL_W = 14;
const DAY_LABEL_MR = 6;

const groupW = (n: number) => n * CELL + (n - 1) * CELL_GAP;

// ─── Status colours (semantic, not arbitrary) ──────────────────────────────────
const statusColors: Record<WorksectionDayStatus, string> = {
  green:  "var(--apex-primary)",
  red:    "var(--apex-danger)",
  gray:   "var(--apex-border)",
  frozen: "var(--apex-info-text)",
  future: "transparent",
  out:    "transparent",
};

const statusLabels: Record<WorksectionDayStatus, string> = {
  green:  "Зелёный",
  red:    "Штраф",
  gray:   "Выходной",
  frozen: "Отпуск",
  future: "Ещё не наступил",
  out:    "",
};

type Day = WorksectionStreak["calendarDays"][0];

interface MonthGroup {
  key: string;
  name: string;
  weekStart: number;
  weekCount: number;
}

function buildMonthGroups(weeks: Day[][]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  weeks.forEach((week, weekIdx) => {
    const counts: Record<string, number> = {};
    week.forEach((day) => {
      if (day.status !== "out") {
        const m = day.date.slice(0, 7);
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
    if (!entries.length) return;
    const [key] = entries[0];
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.weekCount++;
    } else {
      const raw = new Date(key + "-15").toLocaleString("ru-RU", { month: "long" });
      groups.push({
        key,
        name: raw.charAt(0).toUpperCase() + raw.slice(1),
        weekStart: weekIdx,
        weekCount: 1,
      });
    }
  });
  return groups;
}

// ─── Compact streak row ───────────────────────────────────────────────────────

function CompactStreakRow({
  label,
  currentDays,
  milestones,
  variant = "teal",
}: {
  label: string;
  currentDays: number;
  milestones: StreakMilestone[];
  variant?: "teal" | "orange";
}) {
  const next = milestones.find((m) => !m.reached);
  const prev = [...milestones].reverse().find((m) => m.reached);
  const from = prev ? prev.days : 0;
  const to = next ? next.days : milestones[milestones.length - 1].days;
  const pct = next ? Math.min(((currentDays - from) / (to - from)) * 100, 100) : 100;

  const isTeal = variant === "teal";
  const accent = isTeal ? "var(--apex-primary)" : "var(--orange-500)";
  const trackBg = isTeal ? "var(--teal-100)" : "var(--orange-50)";
  const fill = isTeal ? "var(--apex-primary)" : "var(--orange-500)";
  const reachedBg = isTeal ? "var(--apex-success-bg)" : "var(--orange-50)";
  const reachedBorder = isTeal
    ? `rgba(var(--apex-primary-rgb), 0.2)`
    : `rgba(var(--orange-500-rgb), 0.2)`;

  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--apex-text-muted)" }}
      >
        {label}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[20px] font-bold leading-none shrink-0" style={{ color: "var(--apex-text)" }}>
          {currentDays}
          <span className="text-[11px] font-medium ml-0.5" style={{ color: "var(--apex-text-secondary)" }}>д</span>
        </span>
        {next && (
          <>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: trackBg }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: fill }}
              />
            </div>
            <span className="text-[10px] font-semibold shrink-0" style={{ color: accent }}>
              +{next.reward} б
            </span>
          </>
        )}
      </div>
      <div className="flex gap-1 flex-wrap">
        {milestones.map((m) => (
          <div
            key={m.days}
            className="flex items-center px-1.5 py-0.5 rounded-full"
            style={{
              background: m.reached ? reachedBg : "var(--apex-bg)",
              border: `1px solid ${reachedBorder}`,
              opacity: m.reached ? 1 : 0.55,
            }}
          >
            <span
              className="text-[9px] font-semibold"
              style={{ color: m.reached ? accent : "var(--apex-text-muted)" }}
            >
              {m.reached ? "✓ " : ""}{m.days}д
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main grid card ───────────────────────────────────────────────────────────

function WSContributionGrid({ streak }: { streak: WorksectionStreak }) {
  const weeks: Day[][] = [];
  for (let i = 0; i < streak.calendarDays.length; i += 7) {
    weeks.push(streak.calendarDays.slice(i, i + 7));
  }

  const monthGroups = buildMonthGroups(weeks);
  const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const headerOffset = DAY_LABEL_W + DAY_LABEL_MR;

  return (
    <div
      className="rounded-2xl p-5 card-hover"
      style={{
        background: "var(--apex-surface)",
        border: "1px solid var(--apex-border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: "var(--apex-success-bg)" }}
        >
          <Trophy size={14} style={{ color: "var(--apex-primary)" }} />
        </div>
        <span
          className="text-[12px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--apex-text-muted)" }}
        >
          Worksection и автоматизации
        </span>
      </div>

      {/* Streak counter + quarter grid */}
      <div className="flex items-start gap-5 mb-4">
        <div className="shrink-0">
          <div className="text-3xl font-bold" style={{ color: "var(--apex-text)" }}>
            {streak.currentDays}
          </div>
          <div className="text-[12px] font-medium" style={{ color: "var(--apex-text-secondary)" }}>
            дней подряд
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Month labels */}
          <div className="flex mb-1" style={{ paddingLeft: headerOffset }}>
            {monthGroups.map((group, gIdx) => (
              <Fragment key={group.key}>
                {gIdx > 0 && <div style={{ width: MONTH_SEP }} />}
                <div style={{ width: groupW(group.weekCount) }}>
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--apex-text-muted)" }}
                  >
                    {group.name}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>

          {/* Grid body */}
          <div className="flex items-start">
            <div
              className="flex flex-col shrink-0"
              style={{ width: DAY_LABEL_W, marginRight: DAY_LABEL_MR, gap: CELL_GAP }}
            >
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex items-center text-[9px] font-medium"
                  style={{ height: CELL, color: "var(--apex-text-muted)" }}
                >
                  {label}
                </div>
              ))}
            </div>

            {monthGroups.map((group, gIdx) => (
              <Fragment key={group.key}>
                {gIdx > 0 && (
                  <div style={{ width: MONTH_SEP, display: "flex", justifyContent: "center" }}>
                    <div
                      style={{ width: 1, alignSelf: "stretch", background: "var(--apex-border)", opacity: 0.7 }}
                    />
                  </div>
                )}
                <div className="flex" style={{ gap: CELL_GAP }}>
                  {weeks
                    .slice(group.weekStart, group.weekStart + group.weekCount)
                    .map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col" style={{ gap: CELL_GAP }}>
                        {week.map((day) => {
                          const isOut = day.status === "out";
                          const isFuture = day.status === "future";
                          const isGray = day.status === "gray";
                          const showStar = day.automation && day.status !== "frozen";

                          return (
                            <div
                              key={day.date}
                              className="rounded-sm transition-all duration-200 relative"
                              style={{
                                width: CELL,
                                height: CELL,
                                flexShrink: 0,
                                background: isFuture || isOut ? "transparent" : statusColors[day.status],
                                opacity: isOut ? 0 : isGray ? 0.3 : 1,
                                border: isFuture ? `1.5px dashed rgba(var(--apex-primary-rgb), 0.25)` : undefined,
                                boxSizing: "border-box",
                              }}
                              title={
                                isOut
                                  ? undefined
                                  : `${day.date}: ${statusLabels[day.status]}${showStar ? " · Автоматизация ★" : ""}`
                              }
                            >
                              {showStar && (
                                <span
                                  className="absolute inset-0 flex items-center justify-center font-bold leading-none"
                                  style={{ color: "white", fontSize: 10, opacity: 0.9 }}
                                >
                                  ★
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {(["green", "red", "frozen", "gray"] as WorksectionDayStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-xs"
              style={{ background: statusColors[s], opacity: s === "gray" ? 0.3 : 1 }}
            />
            <span className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>{statusLabels[s]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-xs"
            style={{ border: `1.5px dashed rgba(var(--apex-primary-rgb), 0.35)`, boxSizing: "border-box" }}
          />
          <span className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>Будущий</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-xs flex items-center justify-center"
            style={{ background: "var(--apex-primary)" }}
          >
            <span style={{ color: "white", fontSize: 7, lineHeight: 1, fontWeight: "bold" }}>★</span>
          </div>
          <span className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>Автоматизация</span>
        </div>
      </div>

      {/* Two compact streak rows */}
      <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: "1px solid var(--apex-border)" }}>
        <CompactStreakRow
          label="Дисциплина WS"
          currentDays={streak.currentDays}
          milestones={streak.milestones}
          variant="teal"
        />
        <CompactStreakRow
          label="Автоматизации ★"
          currentDays={streak.automationCurrentDays}
          milestones={streak.automationMilestones}
          variant="orange"
        />
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

interface StreakPanelProps {
  worksectionStreak: WorksectionStreak;
}

export function StreakPanel({ worksectionStreak }: StreakPanelProps) {
  return <WSContributionGrid streak={worksectionStreak} />;
}
