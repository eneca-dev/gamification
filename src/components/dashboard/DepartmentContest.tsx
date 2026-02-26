"use client";

import { Trophy, Users, Clock } from "lucide-react";
import type { DepartmentEntry } from "@/lib/data";

interface DepartmentContestProps {
  departments: DepartmentEntry[];
  daysLeft: number;
}

export function DepartmentContest({ departments, daysLeft }: DepartmentContestProps) {
  const leader = departments[0];
  const currentDept = departments.find((d) => d.isCurrentDepartment);
  const currentRank = currentDept?.rank ?? null;

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
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={14} style={{ color: "var(--orange-500)" }} />
          <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Соревнование отделов
          </div>
        </div>
        {/* Timer */}
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

      {/* Prize banner */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl mb-4"
        style={{
          background: "linear-gradient(135deg, rgba(255,152,0,0.06), rgba(255,167,38,0.03))",
          border: "1px solid rgba(255,152,0,0.15)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🏆</span>
          <div>
            <div className="text-[12px] font-extrabold" style={{ color: "var(--text-primary)" }}>
              Топ-1 отдел
            </div>
            <div className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
              каждому сотруднику
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-extrabold" style={{ color: "var(--orange-500)" }}>
            +200 ПК
          </div>
          <div className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
            в конце месяца
          </div>
        </div>
      </div>

      {/* Metric label */}
      <div className="flex items-center gap-1.5 mb-3">
        <Users size={11} style={{ color: "var(--text-muted)" }} />
        <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
          % сотрудников, использующих плагины
        </span>
      </div>

      {/* Departments list */}
      <div className="space-y-2">
        {departments.map((dept) => {
          const isFirst = dept.rank === 1;
          const isCurrent = dept.isCurrentDepartment;

          return (
            <div
              key={dept.rank}
              className="rounded-xl px-3 py-2.5"
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
              <div className="flex items-center gap-3 mb-1.5">
                {/* Rank badge */}
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
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

                {/* Dept color dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: dept.color }}
                />

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[12px] font-bold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {dept.name}
                    </span>
                    {isCurrent && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: "var(--green-100)", color: "var(--green-700)" }}
                      >
                        Мой
                      </span>
                    )}
                    {isFirst && !isCurrent && (
                      <span className="text-[11px] flex-shrink-0">👑</span>
                    )}
                  </div>
                </div>

                {/* Percent */}
                <div className="text-right flex-shrink-0">
                  <span
                    className="text-[15px] font-extrabold"
                    style={{
                      color: isFirst
                        ? "var(--orange-500)"
                        : isCurrent
                          ? "var(--green-600)"
                          : "var(--text-primary)",
                    }}
                  >
                    {dept.usagePercent}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${dept.usagePercent}%`,
                      background: isFirst
                        ? "linear-gradient(90deg, var(--orange-400), var(--orange-500))"
                        : isCurrent
                          ? "linear-gradient(90deg, var(--green-400), var(--green-500))"
                          : dept.color,
                      opacity: isCurrent || isFirst ? 1 : 0.7,
                    }}
                  />
                </div>
                <span className="text-[10px] font-medium flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  {dept.employeesUsing}/{dept.totalEmployees}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom: gap to leader */}
      {currentDept && currentRank !== 1 && (
        <div
          className="mt-3 pt-3 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
            До лидера ({leader.name.split(" ")[0]})
          </div>
          <div
            className="text-[12px] font-extrabold px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(255,152,0,0.08)", color: "var(--orange-500)" }}
          >
            −{leader.usagePercent - (currentDept.usagePercent ?? 0)}%
          </div>
        </div>
      )}

      {currentRank === 1 && (
        <div
          className="mt-3 pt-3 flex items-center gap-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span className="text-sm">🎉</span>
          <div className="text-[11px] font-bold" style={{ color: "var(--green-600)" }}>
            Ваш отдел лидирует! Продолжайте использовать плагины.
          </div>
        </div>
      )}
    </div>
  );
}
