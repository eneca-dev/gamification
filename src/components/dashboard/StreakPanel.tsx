"use client";

import { Fragment } from "react";
import { Trophy, CheckCircle2 } from "lucide-react";
import { CoinIcon } from "@/components/CoinIcon";
import { sourceColors } from "@/lib/data";
import type { DailyTask } from "@/lib/data";
import type { CalendarDayStatus, CalendarDay, RedReason, StreakMilestone, StreakPanelData } from "@/modules/streak-panel";
import { StreakShieldAlert } from "@/modules/streak-shield/components/StreakShieldAlert";
import type { PendingReset } from "@/modules/streak-shield/types";

// ─── Layout constants ────────────────────────────────────────────────────────
const CELL = 18;
const CELL_GAP = 3;
const MONTH_SEP = 10;
const DAY_LABEL_W = 14;
const DAY_LABEL_MR = 6;

const groupW = (n: number) => n * CELL + (n - 1) * CELL_GAP;

// ─── Status colours ──────────────────────────────────────────────────────────
const statusColors: Record<CalendarDayStatus, string> = {
  green:   "var(--apex-primary)",
  red:     "var(--apex-danger)",
  gray:    "#C5CCCC",
  frozen:  "var(--apex-info-text)",
  future:  "transparent",
  out:     "transparent",
  no_data: "#C5CCCC",
};

const statusLabels: Record<CalendarDayStatus, string> = {
  green:   "Зелёный",
  red:     "Штраф",
  gray:    "Выходной",
  frozen:  "Отпуск",
  future:  "Ещё не наступил",
  out:     "",
  no_data: "Нет данных",
};

const absenceLabels: Record<string, string> = {
  vacation:   "Отпуск",
  sick_leave: "Больничный",
  sick_day:   "Оплачиваемый больничный",
};

interface MonthGroup {
  key: string;
  name: string;
  weekStart: number;
  weekCount: number;
}

// Разбиваем дни на недели (Пн=0), потом группируем недели по месяцам
function buildWeeksAndMonths(calendarDays: CalendarDay[]) {
  const firstDate = new Date(calendarDays[0].date + "T00:00:00");
  const firstDow = (firstDate.getDay() + 6) % 7;

  const padded: (CalendarDay | null)[] = [];
  for (let i = 0; i < firstDow; i++) padded.push(null);
  for (const day of calendarDays) padded.push(day);
  while (padded.length % 7 !== 0) padded.push(null);

  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  const groups: MonthGroup[] = [];
  weeks.forEach((week, weekIdx) => {
    const counts: Record<string, number> = {};
    week.forEach((day) => {
      if (day && day.status !== "out") {
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

  return { weeks, groups };
}

// Построение WS URL задачи
function buildTaskUrl(reason: RedReason): string | null {
  if (!reason.ws_project_id || !reason.ws_task_id) return null;
  const base = "https://eneca.worksection.com/project";
  if (reason.ws_l2_id) {
    return `${base}/${reason.ws_project_id}/${reason.ws_l2_id}/${reason.ws_task_id}/`;
  }
  return `${base}/${reason.ws_project_id}/${reason.ws_task_id}/`;
}

// Человеко-читаемое описание причины красного дня
function formatRedReason(reason: RedReason): string {
  if (reason.type === "red_day") {
    return "Не внесён отчёт";
  }
  if (reason.type === "task_dynamics_violation") {
    const taskName = reason.ws_task_name ?? "неизвестная задача";
    const url = buildTaskUrl(reason);
    return url
      ? `В задаче «${taskName}» не был вовремя сменён процент готовности — ${url}`
      : `В задаче «${taskName}» не был вовремя сменён процент готовности`;
  }
  if (reason.type === "section_red") {
    const taskName = reason.ws_task_name ?? "неизвестная задача";
    const url = buildTaskUrl(reason);
    return url
      ? `В задаче «${taskName}» не была вовремя сменена метка готовности — ${url}`
      : `В задаче «${taskName}» не была вовремя сменена метка готовности`;
  }
  return reason.type;
}

// Тултип для ячейки
function getDayTooltip(day: CalendarDay): string | undefined {
  if (day.status === "out") return undefined;

  let text = `${day.date}: ${statusLabels[day.status]}`;

  if (day.status === "frozen" && day.absenceType) {
    text = `${day.date}: ${absenceLabels[day.absenceType] ?? day.absenceType}`;
  }

  if (day.status === "red" && day.redReasons?.length) {
    const reasons = day.redReasons.map(formatRedReason);
    text += `\n${reasons.join("\n")}`;
  }

  if (day.automation && day.status !== "frozen") {
    text += " · Автоматизация ★";
  }

  return text;
}

// ─── Compact streak row ──────────────────────────────────────────────────────

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
            <span className="text-[10px] font-semibold shrink-0 inline-flex items-center gap-0.5" style={{ color: accent }}>
              +{next.reward} <CoinIcon size={10} />
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

// ─── Inline daily quests (compact, no card wrapper) ──────────────────────────

function InlineDailyQuests({ tasks }: { tasks: DailyTask[] }) {
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalReward = tasks.reduce((s, t) => s + t.reward, 0);
  const allDone = tasks.length > 0 && completedCount === tasks.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="text-[12px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--apex-text-muted)" }}
        >
          Ежедневные задания
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: "var(--orange-50)",
            color: "var(--tag-orange-text)",
            border: "1px solid rgba(var(--orange-500-rgb), 0.2)",
          }}
        >
          <span className="inline-flex items-center gap-0.5">+{totalReward} <CoinIcon size={10} /></span>
        </span>
        <span
          className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold ml-auto"
          style={{
            background: allDone ? "var(--apex-success-bg)" : "var(--apex-bg)",
            color: allDone ? "var(--apex-primary)" : "var(--apex-text-muted)",
            border: `1px solid ${allDone ? "rgba(var(--apex-primary-rgb), 0.2)" : "var(--apex-border)"}`,
          }}
        >
          {completedCount}/{tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 flex-1">
        {tasks.map((task) => {
          const srcColor = sourceColors[task.source];
          return (
            <div
              key={task.id}
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{
                background: task.completed ? "var(--apex-success-bg)" : "var(--apex-bg)",
                border: task.completed
                  ? "1px solid rgba(var(--apex-primary-rgb), 0.15)"
                  : "1px solid var(--apex-border)",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 mt-0.5"
                style={{
                  background: task.completed ? "var(--apex-success-bg)" : "var(--apex-surface)",
                  border: "1px solid var(--apex-border)",
                }}
              >
                {task.completed
                  ? <CheckCircle2 size={16} style={{ color: "var(--apex-primary)" }} />
                  : task.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-semibold"
                    style={{ background: srcColor.bg, color: srcColor.text }}
                  >
                    {srcColor.label}
                  </span>
                </div>
                <div
                  className="text-[13px] font-semibold leading-snug"
                  style={{
                    color: task.completed ? "var(--apex-primary)" : "var(--apex-text)",
                    textDecoration: task.completed ? "line-through" : "none",
                    opacity: task.completed ? 0.8 : 1,
                  }}
                >
                  {task.title}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--apex-text-muted)" }}>
                  {task.description}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full w-16" style={{ background: "var(--apex-border)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(task.progress / task.total) * 100}%`,
                          background: task.completed ? "var(--apex-primary)" : "var(--orange-500)",
                        }}
                      />
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>
                      {task.progress}/{task.total}
                    </span>
                  </div>
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: task.completed ? "var(--apex-success-bg)" : "var(--orange-50)",
                      color: task.completed ? "var(--apex-primary)" : "var(--tag-orange-text)",
                    }}
                  >
                    +{task.reward}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main grid card ──────────────────────────────────────────────────────────

interface StreakPanelProps {
  streakData: StreakPanelData;
  tasks?: DailyTask[];
  pendingResets?: PendingReset[];
  userBalance?: number;
}

export function StreakPanel({ streakData, tasks = [], pendingResets = [], userBalance = 0 }: StreakPanelProps) {
  const { calendarDays, completedCycles, ws, revit } = streakData;
  const { weeks, groups } = buildWeeksAndMonths(calendarDays);
  const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const headerOffset = DAY_LABEL_W + DAY_LABEL_MR;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--apex-surface)",
        border: "1px solid var(--apex-border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
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
          {completedCycles > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                background: "var(--apex-success-bg)",
                color: "var(--apex-primary)",
                border: "1px solid rgba(var(--apex-primary-rgb), 0.2)",
              }}
            >
              {completedCycles}x 90д
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold leading-none" style={{ color: "var(--apex-text)" }}>
            {ws.currentStreak}
          </div>
          <div className="text-[11px]" style={{ color: "var(--apex-text-secondary)" }}>
            дней подряд
          </div>
        </div>
      </div>

      {/* Streak shield alerts */}
      {pendingResets.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {pendingResets.map((p) => (
            <StreakShieldAlert key={p.type} pending={p} userBalance={userBalance} />
          ))}
        </div>
      )}

      {/* Main layout: grid+streaks left, quests right */}
      <div className="flex gap-6">
        {/* Left: grid + legend + streaks */}
        <div className="shrink-0">
          {/* Month labels */}
          <div className="flex mb-1" style={{ paddingLeft: headerOffset }}>
            {groups.map((group, gIdx) => (
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

          {/* Grid body: rows = days of week, columns = weeks */}
          <div className="flex items-start">
            {/* Day labels */}
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

            {/* Week columns grouped by month */}
            {groups.map((group, gIdx) => (
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
                        {week.map((day, dayIdx) => {
                          if (!day) {
                            return (
                              <div
                                key={`empty-${dayIdx}`}
                                style={{ width: CELL, height: CELL, flexShrink: 0 }}
                              />
                            );
                          }

                          const isOut = day.status === "out";
                          const isFuture = day.status === "future";
                          const isNoData = day.status === "no_data";
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
                                opacity: isOut ? 0 : isNoData ? 0.5 : 1,
                                border: isFuture
                                  ? "1.5px dashed rgba(var(--apex-primary-rgb), 0.25)"
                                  : isNoData
                                    ? "1.5px dashed var(--apex-text-muted)"
                                    : undefined,
                                boxSizing: "border-box",
                              }}
                              title={getDayTooltip(day)}
                            >
                              {showStar && (
                                <span
                                  className="absolute inset-0 flex items-center justify-center font-bold leading-none"
                                  style={{
                                    color: "white",
                                    fontSize: 10,
                                    opacity: 0.9,
                                    WebkitTextStroke: isNoData ? "0.5px black" : undefined,
                                  }}
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

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 mb-4 flex-wrap">
            {(["green", "red", "frozen", "gray"] as CalendarDayStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-xs"
                  style={{ background: statusColors[s] }}
                />
                <span className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>{statusLabels[s]}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-xs"
                style={{ background: "#C5CCCC", border: "1.5px dashed var(--apex-text-muted)", boxSizing: "border-box", opacity: 0.5 }}
              />
              <span className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>Нет данных</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-xs"
                style={{ border: "1.5px dashed rgba(var(--apex-primary-rgb), 0.35)", boxSizing: "border-box" }}
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

          {/* Streaks stacked vertically */}
          <div className="flex flex-col gap-3 pt-3" style={{ borderTop: "1px solid var(--apex-border)" }}>
            <CompactStreakRow
              label="Worksection"
              currentDays={ws.currentStreak}
              milestones={ws.milestones}
              variant="teal"
            />
            <CompactStreakRow
              label="Автоматизации ★"
              currentDays={revit.currentStreak}
              milestones={revit.milestones}
              variant="orange"
            />
          </div>
        </div>

        {/* Right: daily quests */}
        {tasks.length > 0 && (
          <div
            className="flex-1 min-w-0 pl-6"
            style={{ borderLeft: "1px solid var(--apex-border)" }}
          >
            <InlineDailyQuests tasks={tasks} />
          </div>
        )}
      </div>
    </div>
  );
}
