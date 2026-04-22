"use client";

import { CheckCircle2, XCircle, Trophy, ExternalLink } from "lucide-react";

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
      bg: "rgba(var(--orange-500-rgb), 0.06)",
      icon: <XCircle size={15} style={{ color: "var(--orange-500)" }} />,
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
  if (type.includes("revoked")) {
    return {
      bg: "rgba(var(--apex-danger-rgb, 239 68 68), 0.06)",
      icon: <Trophy size={15} style={{ color: "var(--apex-danger)" }} />,
      label: "Бонус отозван",
    };
  }
  return { bg: "transparent", icon: null, label: type };
}

// ─── Streak position computing ──────────────────────────────────────────────

function computePositions(events: MasterPlannerEvent[], startPosition: number): (string | null)[] {
  // Страница DESC (сверху новые, снизу старые). Проходим снизу вверх (ASC).
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
      positions[i] = `Бонус`;
    } else if (type.includes("revoked")) {
      positions[i] = "Отозван";
    }
  }

  return positions;
}

// ─── Table ──────────────────────────────────────────────────────────────────

interface MasterPlannerHistoryProps {
  events: MasterPlannerEvent[];
  startPosition: number;
}

export function MasterPlannerHistory({ events, startPosition }: MasterPlannerHistoryProps) {
  const positions = computePositions(events, startPosition);

  return (
    <div className="space-y-0.5">
      {/* Заголовки колонок */}
      <div
        className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--apex-text-muted)", borderBottom: "1px solid var(--apex-border)" }}
      >
        <div className="w-8 shrink-0" />
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

        return (
          <div
            key={evt.eventId}
            className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors"
            style={{ background: style.bg }}
          >
            {/* Иконка */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--apex-surface)", border: "1px solid var(--apex-border)" }}
            >
              {style.icon}
            </div>

            {/* Level badge */}
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: evt.level === "L3" ? "var(--teal-100)" : "var(--orange-50)",
                color: evt.level === "L3" ? "var(--apex-primary)" : "var(--orange-500)",
              }}
            >
              {evt.level}
            </span>

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
                ) : (
                  <span style={{ color: "var(--apex-text-muted)" }}>{style.label}</span>
                )}
              </div>
              {evt.maxTime != null && evt.actualTime != null && (
                <div className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>
                  {evt.actualTime} / {evt.maxTime} ч
                </div>
              )}
            </div>

            {/* Серия */}
            <span
              className="text-[11px] font-semibold shrink-0 w-14 text-center"
              style={{ color: "var(--apex-text-muted)" }}
            >
              {positions[i]}
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
        );
      })}
    </div>
  );
}
