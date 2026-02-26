"use client";

import { Trophy, Clock, Users } from "lucide-react";
import type { DepartmentEntry } from "@/lib/data";

interface DepartmentContestProps {
  departments: DepartmentEntry[];
  daysLeft: number;
}

interface DisciplineColumnProps {
  title: string;
  icon: string;
  prize: number;
  metricLabel: string;
  sorted: (DepartmentEntry & { rank: number })[];
  getMetric: (d: DepartmentEntry) => number;
  getUsing: (d: DepartmentEntry) => number;
  accentColor: string;
}

function DisciplineColumn({
  title,
  icon,
  prize,
  metricLabel,
  sorted,
  getMetric,
  getUsing,
  accentColor,
}: DisciplineColumnProps) {
  const leader = sorted[0];
  const currentDept = sorted.find((d) => d.isCurrentDepartment);
  const currentRank = currentDept?.rank ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* Discipline title */}
      <div className="flex items-center gap-1.5">
        <span className="text-[13px]">{icon}</span>
        <span className="text-[12px] font-bold" style={{ color: accentColor }}>
          {title}
        </span>
      </div>

      {/* Prize */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,152,0,0.06), rgba(255,167,38,0.03))",
          border: "1px solid rgba(255,152,0,0.15)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🏆</span>
          <div>
            <div className="text-[11px] font-extrabold" style={{ color: "var(--text-primary)" }}>
              Топ-1 отдел
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              каждому
            </div>
          </div>
        </div>
        <div className="text-[16px] font-extrabold" style={{ color: "var(--orange-500)" }}>
          +{prize} ПК
        </div>
      </div>

      {/* Metric label */}
      <div className="flex items-center gap-1">
        <Users size={10} style={{ color: "var(--text-muted)" }} />
        <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
          {metricLabel}
        </span>
      </div>

      {/* Departments */}
      <div className="space-y-1.5">
        {sorted.map((dept) => {
          const isFirst = dept.rank === 1;
          const isCurrent = dept.isCurrentDepartment;
          const metric = getMetric(dept);
          const using = getUsing(dept);

          return (
            <div
              key={dept.name}
              className="rounded-xl px-2.5 py-2"
              style={{
                background: isCurrent
                  ? "linear-gradient(135deg, var(--green-50), rgba(76,175,80,0.03))"
                  : isFirst
                    ? "linear-gradient(135deg, rgba(255,152,0,0.05), rgba(255,167,38,0.02))"
                    : "var(--surface)",
                border: isCurrent
                  ? "1px solid var(--green-200)"
                  : isFirst
                    ? "1px solid rgba(255,152,0,0.15)"
                    : "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                {/* Rank */}
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                  style={{
                    background: isFirst
                      ? "linear-gradient(135deg, var(--orange-400), var(--orange-500))"
                      : dept.rank === 2
                        ? "linear-gradient(135deg, #bdbdbd, #9e9e9e)"
                        : dept.rank === 3
                          ? "linear-gradient(135deg, #bcaaa4, #a1887f)"
                          : "var(--surface-elevated)",
                    color: dept.rank <= 3 ? "white" : "var(--text-muted)",
                    border: dept.rank > 3 ? "1px solid var(--border)" : "none",
                  }}
                >
                  {dept.rank}
                </div>

                {/* Color dot */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: dept.color }}
                />

                {/* Name */}
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <span
                    className="text-[11px] font-bold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {dept.shortName}
                  </span>
                  {isCurrent && (
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0"
                      style={{ background: "var(--green-100)", color: "var(--green-700)" }}
                    >
                      Мой
                    </span>
                  )}
                  {isFirst && !isCurrent && (
                    <span className="text-[10px] flex-shrink-0">👑</span>
                  )}
                </div>

                {/* Percent */}
                <span
                  className="text-[13px] font-extrabold flex-shrink-0"
                  style={{
                    color: isFirst
                      ? "var(--orange-500)"
                      : isCurrent
                        ? "var(--green-600)"
                        : "var(--text-primary)",
                  }}
                >
                  {metric}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-1.5">
                <div
                  className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ background: "var(--border)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${metric}%`,
                      background: isFirst
                        ? "linear-gradient(90deg, var(--orange-400), var(--orange-500))"
                        : isCurrent
                          ? "linear-gradient(90deg, var(--green-400), var(--green-500))"
                          : dept.color,
                      opacity: isCurrent || isFirst ? 1 : 0.65,
                    }}
                  />
                </div>
                <span className="text-[9px] font-medium flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  {using}/{dept.totalEmployees}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gap to leader / leading message */}
      {currentDept && currentRank !== 1 && (
        <div
          className="pt-2.5 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
            До лидера ({leader.shortName})
          </div>
          <div
            className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-lg"
            style={{ background: "rgba(255,152,0,0.08)", color: "var(--orange-500)" }}
          >
            −{getMetric(leader) - getMetric(currentDept)}%
          </div>
        </div>
      )}
      {currentRank === 1 && (
        <div
          className="pt-2.5 flex items-center gap-1.5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span className="text-xs">🎉</span>
          <div className="text-[10px] font-bold" style={{ color: "var(--green-600)" }}>
            Ваш отдел лидирует!
          </div>
        </div>
      )}
    </div>
  );
}

export function DepartmentContest({ departments, daysLeft }: DepartmentContestProps) {
  const sortedWs = [...departments]
    .sort((a, b) => b.wsPercent - a.wsPercent)
    .map((d, i) => ({ ...d, rank: i + 1 }));

  const sortedAuto = [...departments]
    .sort((a, b) => b.usagePercent - a.usagePercent)
    .map((d, i) => ({ ...d, rank: i + 1 }));

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy size={14} style={{ color: "var(--orange-500)" }} />
          <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Соревнование отделов
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{ background: "var(--orange-50)", border: "1px solid var(--orange-100)" }}
        >
          <Clock size={11} style={{ color: "var(--orange-500)" }} />
          <span className="text-[11px] font-bold" style={{ color: "var(--orange-500)" }}>
            {daysLeft === 1 ? "1 день" : `${daysLeft} дня`}
          </span>
          <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
            до конца месяца
          </span>
        </div>
      </div>

      {/* Two disciplines side by side */}
      <div className="grid grid-cols-2 gap-5">
        <DisciplineColumn
          title="Worksection"
          icon="📋"
          prize={150}
          metricLabel="% зелёных дней"
          sorted={sortedWs}
          getMetric={(d) => d.wsPercent}
          getUsing={(d) => Math.round((d.wsPercent / 100) * d.totalEmployees)}
          accentColor="var(--green-700)"
        />
        <DisciplineColumn
          title="Автоматизации"
          icon="⚡"
          prize={200}
          metricLabel="% использующих плагины"
          sorted={sortedAuto}
          getMetric={(d) => d.usagePercent}
          getUsing={(d) => d.employeesUsing}
          accentColor="var(--orange-500)"
        />
      </div>
    </div>
  );
}
