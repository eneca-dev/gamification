"use client";

import { Fragment } from "react";
import { Trophy } from "lucide-react";
import type { WorksectionStreak, StreakMilestone, WorksectionDayStatus } from "@/lib/data";

// ─── Layout constants ────────────────────────────────────────────────────────
const CELL = 18;        // px — cell width & height (square)
const CELL_GAP = 4;     // px — gap between cells within a month group
const MONTH_SEP = 12;   // px — total width of the separator between months
const DAY_LABEL_W = 14; // px — day-of-week label column width
const DAY_LABEL_MR = 6; // px — margin-right after day labels

// Width of a group of N week-columns (in px)
const groupW = (n: number) => n * CELL + (n - 1) * CELL_GAP;

// ─── Status colours ───────────────────────────────────────────────────────────
const statusColors: Record<WorksectionDayStatus, string> = {
  green: "var(--green-500)",
  red: "#e53935",
  gray: "#e0e0e0",
  frozen: "#90caf9",
  future: "transparent",
  out: "transparent",
};

const statusLabels: Record<WorksectionDayStatus, string> = {
  green: "Зелёный",
  red: "Штраф",
  gray: "Выходной",
  frozen: "Отпуск",
  future: "Ещё не наступил",
  out: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Day = WorksectionStreak["calendarDays"][0];

interface MonthGroup {
  key: string;       // e.g. "2026-01"
  name: string;      // e.g. "Январь"
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
  variant = "blue",
}: {
  label: string;
  currentDays: number;
  milestones: StreakMilestone[];
  variant?: "orange" | "blue";
}) {
  const next = milestones.find((m) => !m.reached);
  const prev = [...milestones].reverse().find((m) => m.reached);
  const from = prev ? prev.days : 0;
  const to = next ? next.days : milestones[milestones.length - 1].days;
  const pct = next ? Math.min(((currentDays - from) / (to - from)) * 100, 100) : 100;

  const isBlue = variant === "blue";
  const accent = isBlue ? "#1976d2" : "#f57c00";
  const trackBg = isBlue ? "rgba(33,150,243,0.12)" : "rgba(255,152,0,0.1)";
  const fill = isBlue
    ? "linear-gradient(90deg, #42a5f5, #1976d2)"
    : "linear-gradient(90deg, #ffb74d, #f57c00)";

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[20px] font-extrabold leading-none shrink-0" style={{ color: "var(--text-primary)" }}>
          {currentDays}
          <span className="text-[11px] font-semibold ml-0.5" style={{ color: "var(--text-secondary)" }}>д</span>
        </span>
        {next && (
          <>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: trackBg }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: fill }}
              />
            </div>
            <span className="text-[10px] font-bold shrink-0" style={{ color: accent }}>
              +{next.reward} б
            </span>
          </>
        )}
      </div>
      <div className="flex gap-1">
        {milestones.map((m) => (
          <div
            key={m.days}
            className="flex items-center px-1.5 py-0.5 rounded-md"
            style={{
              background: m.reached
                ? isBlue ? "rgba(33,150,243,0.15)" : "rgba(255,152,0,0.13)"
                : isBlue ? "rgba(33,150,243,0.05)" : "rgba(255,152,0,0.05)",
              border: `1px solid ${isBlue ? "rgba(33,150,243,0.18)" : "rgba(255,152,0,0.15)"}`,
              opacity: m.reached ? 1 : 0.55,
            }}
          >
            <span className="text-[9px] font-bold" style={{ color: m.reached ? accent : "var(--text-muted)" }}>
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
  // Split flat 98-day array into 14 week-columns (Mon–Sun)
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
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* ── Card header ── */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(33,150,243,0.1)" }}
        >
          <Trophy size={14} style={{ color: "#1976d2" }} />
        </div>
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Worksection и автоматизации
        </span>
      </div>

      {/* ── Streak counter + quarter grid ── */}
      <div className="flex items-start gap-5 mb-4">
        {/* Counter */}
        <div className="shrink-0">
          <div className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            {streak.currentDays}
          </div>
          <div className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            дней подряд
          </div>
        </div>

        {/* Quarter grid */}
        <div className="overflow-x-auto">
          {/* Month name row — offset by day-label column width */}
          <div className="flex mb-1" style={{ paddingLeft: headerOffset }}>
            {monthGroups.map((group, gIdx) => (
              <Fragment key={group.key}>
                {gIdx > 0 && <div style={{ width: MONTH_SEP }} />}
                <div style={{ width: groupW(group.weekCount) }}>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {group.name}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>

          {/* Grid body */}
          <div className="flex items-start">
            {/* Day-of-week labels */}
            <div
              className="flex flex-col shrink-0"
              style={{ width: DAY_LABEL_W, marginRight: DAY_LABEL_MR, gap: CELL_GAP }}
            >
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex items-center text-[9px] font-semibold"
                  style={{ height: CELL, color: "var(--text-muted)" }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Month groups with separators */}
            {monthGroups.map((group, gIdx) => (
              <Fragment key={group.key}>
                {/* Vertical separator between months */}
                {gIdx > 0 && (
                  <div style={{ width: MONTH_SEP, display: "flex", justifyContent: "center" }}>
                    <div
                      style={{
                        width: 1,
                        alignSelf: "stretch",
                        background: "var(--border)",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                )}

                {/* Week columns for this month */}
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
                                background: isFuture || isOut
                                  ? "transparent"
                                  : statusColors[day.status],
                                opacity: isOut ? 0 : isGray ? 0.3 : 1,
                                border: isFuture
                                  ? "1.5px dashed rgba(160,160,160,0.4)"
                                  : undefined,
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
                                  style={{ color: "rgba(255,255,255,0.95)", fontSize: 10 }}
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

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {(["green", "red", "frozen", "gray"] as WorksectionDayStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-xs"
              style={{ background: statusColors[s], opacity: s === "gray" ? 0.3 : 1 }}
            />
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
              {statusLabels[s]}
            </span>
          </div>
        ))}
        {/* Future */}
        <div className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-xs"
            style={{ border: "1.5px dashed rgba(160,160,160,0.5)", boxSizing: "border-box" }}
          />
          <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
            Будущий
          </span>
        </div>
        {/* Automation star */}
        <div className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-xs flex items-center justify-center"
            style={{ background: "var(--green-500)" }}
          >
            <span style={{ color: "white", fontSize: 7, lineHeight: 1, fontWeight: "bold" }}>★</span>
          </div>
          <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
            Автоматизация
          </span>
        </div>
      </div>

      {/* ── Two compact streak rows side by side ── */}
      <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <CompactStreakRow
          label="Дисциплина WS"
          currentDays={streak.currentDays}
          milestones={streak.milestones}
          variant="blue"
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

// ─── Exported panel ───────────────────────────────────────────────────────────

interface StreakPanelProps {
  worksectionStreak: WorksectionStreak;
}

export function StreakPanel({ worksectionStreak }: StreakPanelProps) {
  return <WSContributionGrid streak={worksectionStreak} />;
}
