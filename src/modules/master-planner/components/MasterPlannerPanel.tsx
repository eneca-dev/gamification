import { Trophy, CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";

import type { MasterPlannerPanelData, MasterPlannerEvent, PendingBudgetTask } from "../types";

// ─── Streak row (аналогично CompactStreakRow) ───────────────────────────────

function StreakRow({
  label,
  currentStreak,
  completedCycles,
  reward,
  variant = "teal",
}: {
  label: string;
  currentStreak: number;
  completedCycles: number;
  reward: number;
  variant?: "teal" | "orange";
}) {
  const posInCycle = currentStreak % 10;
  const pct = (posInCycle / 10) * 100;

  const isTeal = variant === "teal";
  const accent = isTeal ? "var(--apex-primary)" : "var(--orange-500)";
  const trackBg = isTeal ? "var(--teal-100)" : "var(--orange-50)";
  const fill = isTeal ? "var(--apex-primary)" : "var(--orange-500)";

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[10px] font-semibold uppercase tracking-wider shrink-0"
        style={{ color: "var(--apex-text-muted)" }}
      >
        {label}
      </span>
      {completedCycles > 0 && (
        <span
          className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0"
          style={{
            background: isTeal ? "var(--apex-success-bg)" : "var(--orange-50)",
            color: accent,
            border: `1px solid ${isTeal ? "rgba(var(--apex-primary-rgb), 0.2)" : "rgba(var(--orange-500-rgb), 0.2)"}`,
          }}
        >
          {completedCycles}x
        </span>
      )}
      <span className="text-[14px] font-bold leading-none shrink-0" style={{ color: "var(--apex-text)" }}>
        {posInCycle}
        <span className="text-[10px] font-medium" style={{ color: "var(--apex-text-secondary)" }}>/10</span>
      </span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: trackBg }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: fill }}
        />
      </div>
      <span className="text-[10px] font-semibold shrink-0" style={{ color: accent }}>
        +{reward} б
      </span>
    </div>
  );
}

// ─── Event icon ─────────────────────────────────────────────────────────────

function EventIcon({ type }: { type: string }) {
  if (type.startsWith("budget_ok")) {
    return <CheckCircle2 size={14} style={{ color: "var(--apex-primary)" }} />;
  }
  if (type.startsWith("budget_exceeded")) {
    return <XCircle size={14} style={{ color: "var(--apex-danger)" }} />;
  }
  if (type.startsWith("budget_revoked")) {
    return <XCircle size={14} style={{ color: "var(--orange-500)" }} />;
  }
  if (type === "master_planner" || type === "master_planner_l2") {
    return <Trophy size={14} style={{ color: "var(--apex-primary)" }} />;
  }
  if (type.includes("revoked")) {
    return <Trophy size={14} style={{ color: "var(--apex-danger)" }} />;
  }
  return null;
}

function eventLabel(type: string): string {
  if (type.startsWith("budget_ok")) return "В бюджете";
  if (type.startsWith("budget_exceeded")) return "Превышение";
  if (type.startsWith("budget_revoked")) return "Отозвано";
  if (type === "master_planner" || type === "master_planner_l2") return "Бонус";
  if (type.includes("revoked")) return "Бонус отозван";
  return type;
}

// ─── Recent events list ─────────────────────────────────────────────────────

function RecentEvents({ events }: { events: MasterPlannerEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {events.map((evt) => (
        <div
          key={evt.eventId}
          className="flex items-center gap-2 py-1 px-2 rounded-lg"
          style={{ background: "var(--apex-bg)" }}
        >
          <EventIcon type={evt.type} />
          <span
            className="text-[10px] font-semibold px-1 py-0.5 rounded"
            style={{
              background: evt.level === "L3" ? "var(--teal-100)" : "var(--orange-50)",
              color: evt.level === "L3" ? "var(--apex-primary)" : "var(--orange-500)",
            }}
          >
            {evt.level}
          </span>
          {evt.taskUrl ? (
            <a
              href={evt.taskUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] flex-1 hover:underline inline-flex items-center gap-1 min-w-0"
              style={{ color: "var(--apex-text)" }}
            >
              <span className="truncate">{evt.taskName ?? eventLabel(evt.type)}</span>
              <ExternalLink size={9} className="shrink-0" style={{ marginTop: "-2px" }} />
            </a>
          ) : (
            <span
              className="text-[11px] truncate flex-1"
              style={{ color: "var(--apex-text)" }}
            >
              {evt.taskName ?? eventLabel(evt.type)}
            </span>
          )}
          <span className="text-[10px] shrink-0" style={{ color: "var(--apex-text-muted)" }}>
            {evt.date}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Pending tasks ──────────────────────────────────────────────────────────

function PendingTasks({ tasks }: { tasks: PendingBudgetTask[] }) {
  if (tasks.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--apex-text-muted)" }}
        >
          Ожидают проверки
        </div>
        {tasks.length > 3 && (
          <Link
            href="/master-planner?status=pending"
            className="text-[10px] font-semibold hover:underline"
            style={{ color: "var(--apex-primary)" }}
          >
            +{tasks.length - 3} ещё →
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {tasks.slice(0, 3).map((task, i) => (
          <div key={i} className="flex items-center gap-2">
            <Clock size={12} style={{ color: "var(--apex-text-muted)" }} />
            <span
              className="text-[10px] font-semibold px-1 py-0.5 rounded"
              style={{
                background: task.level === "L3" ? "var(--teal-100)" : "var(--orange-50)",
                color: task.level === "L3" ? "var(--apex-primary)" : "var(--orange-500)",
              }}
            >
              {task.level}
            </span>
            {task.taskUrl ? (
              <a
                href={task.taskUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] flex-1 hover:underline inline-flex items-center gap-1 min-w-0"
                style={{ color: "var(--apex-text)" }}
              >
                <span className="truncate">{task.taskName}</span>
                <ExternalLink size={9} className="shrink-0" style={{ marginTop: "-2px" }} />
              </a>
            ) : (
              <span className="text-[11px] truncate flex-1" style={{ color: "var(--apex-text)" }}>
                {task.taskName}
              </span>
            )}
            <span className="text-[10px] shrink-0" style={{ color: "var(--apex-text-muted)" }}>
              {task.daysRemaining}д ост.
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface MasterPlannerPanelProps {
  data: MasterPlannerPanelData;
}

export function MasterPlannerPanel({ data }: MasterPlannerPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Заголовок */}
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
            Мастер планирования
          </span>
        </div>
        <Link href="/master-planner" className="text-[12px] font-semibold" style={{ color: "var(--apex-primary)" }}>
          Вся история →
        </Link>
      </div>

      {/* Два стрика в одну строку */}
      <div className="flex gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <StreakRow
            label="L3"
            currentStreak={data.l3.currentStreak}
            completedCycles={data.l3.completedCycles}
            reward={data.l3.reward}
            variant="teal"
          />
        </div>
        <div className="flex-1 min-w-0">
          <StreakRow
            label="L2"
            currentStreak={data.l2.currentStreak}
            completedCycles={data.l2.completedCycles}
            reward={data.l2.reward}
            variant="orange"
          />
        </div>
      </div>

      {/* Pending */}
      {data.pendingTasks.length > 0 && (
        <div className="mb-2 pt-2" style={{ borderTop: "1px solid var(--apex-border)" }}>
          <PendingTasks tasks={data.pendingTasks} />
        </div>
      )}

      {/* Последние события */}
      {data.recentEvents.length > 0 && (
        <div className="mb-2 pt-2" style={{ borderTop: "1px solid var(--apex-border)" }}>
          <div
            className="text-[10px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: "var(--apex-text-muted)" }}
          >
            Последние события
          </div>
          <RecentEvents events={data.recentEvents} />
        </div>
      )}

    </div>
  );
}
