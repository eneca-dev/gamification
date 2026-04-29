"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Trophy, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

import type { MasterPlannerEvent } from "../types";

// ─── Event styling ──────────────────────────────────────────────────────────

interface EventStyle {
  bg: string;
  icon: React.ReactNode;
  label: string;
}

function getEventStyle(type: string): EventStyle {
  if (type.startsWith("budget_ok")) {
    return {
      bg: "transparent",
      icon: <CheckCircle2 size={15} style={{ color: "var(--apex-primary)" }} />,
      label: "Закрыта в бюджете",
    };
  }
  if (type.startsWith("budget_exceeded")) {
    return {
      bg: "rgba(var(--apex-danger-rgb, 239 68 68), 0.06)",
      icon: <XCircle size={15} style={{ color: "var(--apex-danger)" }} />,
      label: "Превышение бюджета",
    };
  }
  if (type.startsWith("budget_revoked")) {
    return {
      bg: "rgba(var(--apex-danger-rgb, 239 68 68), 0.06)",
      icon: <XCircle size={15} style={{ color: "var(--apex-danger)" }} />,
      label: "Отозвано (доработки)",
    };
  }
  if (type === "master_planner" || type === "master_planner_l2") {
    return {
      bg: "rgba(var(--apex-primary-rgb), 0.06)",
      icon: <Trophy size={15} style={{ color: "var(--apex-primary)" }} />,
      label: "Бонус",
    };
  }
  if (type === "deadline_ok_l3") {
    return {
      bg: "transparent",
      icon: <CheckCircle2 size={15} style={{ color: "var(--apex-primary)" }} />,
      label: "Закрыта в срок",
    };
  }
  if (type === "deadline_revoked_l3") {
    return {
      bg: "rgba(var(--apex-danger-rgb, 239 68 68), 0.06)",
      icon: <XCircle size={15} style={{ color: "var(--apex-danger)" }} />,
      label: "Отозвано (срок)",
    };
  }
  if (type.includes("revoked")) {
    return {
      bg: "rgba(var(--apex-danger-rgb, 239 68 68), 0.06)",
      icon: <Trophy size={15} style={{ color: "var(--apex-danger)" }} />,
      label: "Бонус отозван",
    };
  }
  return { bg: "transparent", icon: null, label: type };
}

// ─── Streak position computing (только для budget событий) ─────────────────

function computePositions(events: MasterPlannerEvent[], startPosition: number): (string | null)[] {
  const positions: (string | null)[] = new Array(events.length).fill(null);
  let pos = startPosition;

  for (let i = events.length - 1; i >= 0; i--) {
    const type = events[i].type;

    if (type.startsWith("budget_ok")) {
      pos++;
      positions[i] = String(pos);
    } else if (type.startsWith("budget_exceeded")) {
      pos = 0;
      positions[i] = "Сброс";
    } else if (type.startsWith("budget_revoked")) {
      positions[i] = "Отозвано";
    } else if (type === "master_planner" || type === "master_planner_l2") {
      positions[i] = "Бонус";
    } else if (type.includes("revoked")) {
      positions[i] = "Отозвано";
    }
    // deadline события — позиция остаётся null (покажем "—")
  }

  return positions;
}

// ─── Level badge с тултипом ─────────────────────────────────────────────────

function LevelBadge({ level }: { level: "L3" | "L2" }) {
  const tooltipText = level === "L3"
    ? "Задача 3-го уровня. Серия считается только по задачам с бюджетом"
    : "Задача 2-го уровня. Серия считается только по задачам с бюджетом";

  return (
    <div className="relative inline-flex group/badge shrink-0">
      <span
        className="text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-default"
        style={{
          background: level === "L3" ? "var(--teal-100)" : "var(--orange-50)",
          color: level === "L3" ? "var(--apex-primary)" : "var(--orange-500)",
        }}
      >
        {level}
      </span>
      <div
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg text-[10px] whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity z-20"
        style={{ background: "var(--apex-text)", color: "var(--apex-surface)" }}
      >
        {tooltipText}
      </div>
    </div>
  );
}

// ─── Table ──────────────────────────────────────────────────────────────────

interface MasterPlannerHistoryProps {
  events: MasterPlannerEvent[];
  startPosition: number;
}

export function MasterPlannerHistory({ events, startPosition }: MasterPlannerHistoryProps) {
  const positions = computePositions(events, startPosition);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-0.5">
      {/* Заголовки колонок */}
      <div
        className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--apex-text-muted)", borderBottom: "1px solid var(--apex-border)" }}
      >
        <div className="w-8 shrink-0" />
        <span className="shrink-0 w-4" />
        <span className="shrink-0 w-6" />
        <div className="flex-1 min-w-0">Задача</div>
        <span className="shrink-0 w-14 text-center">Серия</span>
        <span className="shrink-0 w-14 text-right">💎</span>
        <span className="shrink-0 w-12 text-right">Дата</span>
      </div>

      {events.map((evt, i) => {
        const style = getEventStyle(evt.type);
        const dateFormatted = new Date(evt.date + "T00:00:00").toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
        });
        const bonusTasks = evt.milestoneTasks ?? evt.revokedTasks ?? null;
        const hasBonusTasks = bonusTasks != null && bonusTasks.length > 0;
        const isExpanded = expandedIds.has(evt.eventId);
        const isRevokeRow = evt.type.includes("revoked");

        return (
          <div key={evt.eventId}>
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors"
            style={{ background: style.bg }}
          >
            {/* Иконка события */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--apex-surface)", border: "1px solid var(--apex-border)" }}
            >
              {style.icon}
            </div>

            {/* Иконка категории 💲 / ⏳ */}
            <span
              className="text-[11px] shrink-0 w-4 text-center"
              title={evt.category === "budget" ? "По бюджету" : "По сроку"}
            >
              {evt.category === "budget" ? "💲" : "⏳"}
            </span>

            {/* Level badge */}
            <LevelBadge level={evt.level} />

            {/* Тип + задача */}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium truncate" style={{ color: "var(--apex-text)" }}>
                {evt.taskName ? (
                  evt.taskUrl ? (
                    <a
                      href={evt.taskUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline inline-flex items-center gap-1"
                      style={{ color: "var(--apex-primary)" }}
                    >
                      {evt.taskName}
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                  ) : (
                    evt.taskName
                  )
                ) : hasBonusTasks ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(evt.eventId)}
                    className="inline-flex items-center gap-1 hover:underline"
                    style={{ color: "var(--apex-text)" }}
                  >
                    <span>{style.label}</span>
                    <span style={{ color: "var(--apex-text-muted)" }}>
                      ({bonusTasks!.length} {pluralizeTasks(bonusTasks!.length)})
                    </span>
                    {isExpanded
                      ? <ChevronUp size={12} style={{ color: "var(--apex-text-muted)" }} />
                      : <ChevronDown size={12} style={{ color: "var(--apex-text-muted)" }} />
                    }
                  </button>
                ) : (
                  <span style={{ color: "var(--apex-text-muted)" }}>{style.label}</span>
                )}
              </div>
              {/* Budget: часы + дата закрытия задачи */}
              {evt.category === "budget" && evt.maxTime != null && evt.actualTime != null && (
                <div className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>
                  {formatHours(evt.actualTime)} / {formatHours(evt.maxTime)} ч
                  {evt.dateClosed && ` · закрыта: ${formatDDMMYYYY(evt.dateClosed)}`}
                </div>
              )}
              {/* Deadline: план / факт */}
              {evt.category === "deadline" && evt.plannedEnd && evt.dateClosed && (
                <div className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>
                  план: {formatDDMMYYYY(evt.plannedEnd)} · факт: {formatDDMMYYYY(evt.dateClosed)}
                </div>
              )}
            </div>

            {/* Серия */}
            <span
              className="text-[11px] font-semibold shrink-0 w-14 text-center"
              style={{ color: "var(--apex-text-muted)" }}
            >
              {positions[i] ?? "—"}
            </span>

            {/* 💎 */}
            <span
              className="text-[11px] font-bold shrink-0 w-14 text-right"
              style={{
                color: evt.coins != null && evt.coins > 0
                  ? "var(--apex-primary)"
                  : evt.coins != null && evt.coins < 0
                    ? "var(--apex-danger)"
                    : "var(--apex-text-muted)",
              }}
            >
              {evt.coins != null && evt.coins > 0 ? `+${evt.coins}` : evt.coins ?? 0}
            </span>

            {/* Дата */}
            <span className="text-[10px] shrink-0 w-12 text-right" style={{ color: "var(--apex-text-muted)" }}>
              {dateFormatted}
            </span>
          </div>

          {/* Развёрнутый список задач для бонусной/отзывной строки */}
          {hasBonusTasks && isExpanded && (
            <div
              className="mt-1 ml-14 mr-3 mb-2 px-3 py-2 rounded-xl space-y-1"
              style={{ background: "var(--apex-bg)", border: "1px solid var(--apex-border)" }}
            >
              {bonusTasks!.map((task, idx) => {
                const linkColor = isRevokeRow ? "var(--apex-danger)" : "var(--apex-primary)";
                const textColor = isRevokeRow ? "var(--apex-danger)" : "var(--apex-text)";
                return (
                  <div key={task.id} className="flex items-start gap-2 text-[11px]">
                    <span className="shrink-0 w-5 text-right pt-0.5" style={{ color: "var(--apex-text-muted)" }}>
                      {idx + 1}.
                    </span>
                    {isRevokeRow && (
                      <XCircle size={11} className="shrink-0 mt-0.5" style={{ color: "var(--apex-danger)" }} />
                    )}
                    <div className="min-w-0 flex-1">
                      {task.url ? (
                        <a
                          href={task.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline inline-flex items-center gap-1 min-w-0"
                          style={{ color: linkColor }}
                        >
                          <span className={`truncate ${isRevokeRow ? "line-through" : ""}`}>{task.name}</span>
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      ) : (
                        <span className={`truncate ${isRevokeRow ? "line-through" : ""}`} style={{ color: textColor }}>{task.name}</span>
                      )}
                      {task.dateClosed && (
                        <div className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>
                          закрыта: {formatDDMMYYYY(task.dateClosed)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        );
      })}
    </div>
  );
}

function formatDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

// Округляет до 2 знаков, без хвостовых нулей: 145.17000000000002 → 145.17, 120.5 → 120.5, 8 → 8
function formatHours(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function pluralizeTasks(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return "задач";
  if (mod10 === 1) return "задача";
  if (mod10 >= 2 && mod10 <= 4) return "задачи";
  return "задач";
}
