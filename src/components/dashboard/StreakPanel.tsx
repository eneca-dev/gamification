"use client";

import { Flame, Snowflake, Trophy } from "lucide-react";
import type { RevitStreak, WorksectionStreak, StreakMilestone, WorksectionDayStatus } from "@/lib/data";

// ===== Revit Streak Card =====

function RevitStreakCard({ streak }: { streak: RevitStreak }) {
  const nextMilestone = streak.milestones.find((m) => !m.reached);
  const prevMilestone = [...streak.milestones].reverse().find((m) => m.reached);
  const progressFrom = prevMilestone ? prevMilestone.days : 0;
  const progressTo = nextMilestone ? nextMilestone.days : streak.milestones[streak.milestones.length - 1].days;
  const progressPercent = Math.min(
    ((streak.currentDays - progressFrom) / (progressTo - progressFrom)) * 100,
    100
  );

  return (
    <div
      className="rounded-2xl p-5 card-hover h-full"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: "var(--orange-50)" }}
        >
          <Flame size={14} style={{ color: "var(--orange-500)" }} />
        </div>
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Серия автоматизаций
        </span>
      </div>

      {/* Big flame counter */}
      <div className="flex items-center gap-4 mb-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, var(--orange-50), rgba(255,152,0,0.08))",
            border: "2px solid var(--orange-100)",
          }}
        >
          <span className="text-3xl">🔥</span>
        </div>
        <div>
          <div className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            {streak.currentDays}
          </div>
          <div className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            дней подряд
          </div>
        </div>
      </div>

      {/* Progress to next milestone */}
      {nextMilestone && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
              До награды: {nextMilestone.days} дней
            </span>
            <span className="text-[11px] font-bold" style={{ color: "var(--orange-500)" }}>
              +{nextMilestone.reward} ПК
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full" style={{ background: "var(--orange-100)" }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, var(--orange-400), var(--orange-500))",
              }}
            />
          </div>
          <div className="text-[10px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
            {streak.currentDays} / {nextMilestone.days} дней
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="flex gap-2">
        {streak.milestones.map((m) => (
          <MilestoneBadge key={m.days} milestone={m} />
        ))}
      </div>
    </div>
  );
}

// ===== Worksection Streak Card =====

const statusColors: Record<WorksectionDayStatus, string> = {
  green: "var(--green-500)",
  red: "#e53935",
  gray: "#e0e0e0",
  frozen: "#90caf9",
};

const statusLabels: Record<WorksectionDayStatus, string> = {
  green: "Зелёный",
  red: "Штраф",
  gray: "Выходной",
  frozen: "Отпуск",
};

function WSContributionGrid({ streak }: { streak: WorksectionStreak }) {
  const nextMilestone = streak.milestones.find((m) => !m.reached);
  const prevMilestone = [...streak.milestones].reverse().find((m) => m.reached);
  const progressFrom = prevMilestone ? prevMilestone.days : 0;
  const progressTo = nextMilestone ? nextMilestone.days : streak.milestones[streak.milestones.length - 1].days;
  const progressPercent = Math.min(
    ((streak.currentDays - progressFrom) / (progressTo - progressFrom)) * 100,
    100
  );

  // Organize days into 5 columns (weeks) x 7 rows (days)
  const weeks: typeof streak.calendarDays[] = [];
  for (let i = 0; i < streak.calendarDays.length; i += 7) {
    weeks.push(streak.calendarDays.slice(i, i + 7));
  }

  const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div
      className="rounded-2xl p-5 card-hover h-full"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(33,150,243,0.1)" }}
        >
          <Trophy size={14} style={{ color: "#1976d2" }} />
        </div>
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Дисциплина Worksection
        </span>
      </div>

      {/* Streak counter + grid */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0">
          <div className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            {streak.currentDays}
          </div>
          <div className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            дней подряд
          </div>
        </div>

        {/* Contribution grid */}
        <div className="flex-1">
          <div className="flex gap-1">
            {/* Day labels */}
            <div className="flex flex-col gap-1 mr-1">
              {dayLabels.map((label) => (
                <div
                  key={label}
                  className="h-[18px] flex items-center text-[9px] font-semibold"
                  style={{ color: "var(--text-muted)" }}
                >
                  {label}
                </div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-1">
                {week.map((day) => (
                  <div
                    key={day.date}
                    className="w-[18px] h-[18px] rounded-[4px] transition-all duration-200"
                    style={{
                      background: statusColors[day.status],
                      opacity: day.status === "gray" ? 0.4 : 1,
                    }}
                    title={`${day.date}: ${statusLabels[day.status]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-4">
        {(Object.keys(statusColors) as WorksectionDayStatus[]).map((status) => (
          <div key={status} className="flex items-center gap-1">
            <div
              className="w-[10px] h-[10px] rounded-[2px]"
              style={{
                background: statusColors[status],
                opacity: status === "gray" ? 0.4 : 1,
              }}
            />
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
              {statusLabels[status]}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <Snowflake size={10} style={{ color: "#90caf9" }} />
          <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
            = стрик сохраняется
          </span>
        </div>
      </div>

      {/* Progress to next milestone */}
      {nextMilestone && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
              До награды: {nextMilestone.days} дней
            </span>
            <span className="text-[11px] font-bold" style={{ color: "#1976d2" }}>
              +{nextMilestone.reward} ПК
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full" style={{ background: "rgba(33,150,243,0.12)" }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, #42a5f5, #1976d2)",
              }}
            />
          </div>
          <div className="text-[10px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
            {streak.currentDays} / {nextMilestone.days} дней
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="flex gap-2">
        {streak.milestones.map((m) => (
          <MilestoneBadge key={m.days} milestone={m} variant="blue" />
        ))}
      </div>
    </div>
  );
}

// ===== Shared Milestone Badge =====

function MilestoneBadge({
  milestone,
  variant = "orange",
}: {
  milestone: StreakMilestone;
  variant?: "orange" | "blue";
}) {
  const colors = variant === "blue"
    ? { bg: "rgba(33,150,243,0.08)", border: "rgba(33,150,243,0.15)", text: "#1976d2", reachedBg: "rgba(33,150,243,0.15)" }
    : { bg: "rgba(255,152,0,0.06)", border: "rgba(255,152,0,0.12)", text: "var(--orange-500)", reachedBg: "rgba(255,152,0,0.12)" };

  return (
    <div
      className="flex-1 rounded-xl px-2.5 py-2 text-center"
      style={{
        background: milestone.reached ? colors.reachedBg : colors.bg,
        border: `1px solid ${colors.border}`,
        opacity: milestone.reached ? 1 : 0.6,
      }}
    >
      <div className="text-[10px] font-bold" style={{ color: milestone.reached ? colors.text : "var(--text-muted)" }}>
        {milestone.reached ? "✅" : "⬜"} {milestone.days}д
      </div>
      <div className="text-[10px] font-semibold" style={{ color: colors.text }}>
        +{milestone.reward}
      </div>
    </div>
  );
}

// ===== Exported Panel =====

interface StreakPanelProps {
  revitStreak: RevitStreak;
  worksectionStreak: WorksectionStreak;
}

export function StreakPanel({ revitStreak, worksectionStreak }: StreakPanelProps) {
  return (
    <>
      <RevitStreakCard streak={revitStreak} />
      <WSContributionGrid streak={worksectionStreak} />
    </>
  );
}
