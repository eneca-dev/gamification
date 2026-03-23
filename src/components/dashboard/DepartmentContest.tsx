"use client";

import { Trophy, Clock, Users } from "lucide-react";
import type { DepartmentEntry } from "@/lib/data";

interface DepartmentContestProps {
  departments: DepartmentEntry[];
  automationDepartments?: DepartmentEntry[];
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
  maxMetric: number;
  metricSuffix: string;
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
  maxMetric,
  metricSuffix,
  accentColor,
}: DisciplineColumnProps) {
  const leader = sorted[0];
  const currentDept = sorted.find((d) => d.isCurrentDepartment);
  const currentRank = currentDept?.rank ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[13px]">{icon}</span>
        <span className="text-[12px] font-semibold" style={{ color: accentColor }}>{title}</span>
      </div>

      {/* Prize block */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-xl"
        style={{
          background: "var(--orange-50)",
          border: `1px solid rgba(var(--orange-500-rgb), 0.2)`,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🏆</span>
          <div>
            <div className="text-[11px] font-semibold" style={{ color: "var(--apex-text)" }}>Топ-1 отдел</div>
            <div className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>каждому</div>
          </div>
        </div>
        <div className="text-[16px] font-bold" style={{ color: "var(--orange-500)" }}>+{prize} ПК</div>
      </div>

      {/* Metric label */}
      <div className="flex items-center gap-1">
        <Users size={10} style={{ color: "var(--apex-text-muted)" }} />
        <span className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>{metricLabel}</span>
      </div>

      {/* Department rows — scrollable */}
      <div className="space-y-1.5 max-h-[340px] overflow-y-auto scrollbar-hide">
        {sorted.map((dept) => {
          const isFirst = dept.rank === 1;
          const isCurrent = dept.isCurrentDepartment;
          const metric = getMetric(dept);
          const using = getUsing(dept);

          const rankBg =
            isFirst ? "var(--rank-gold)"
            : dept.rank === 2 ? "var(--rank-silver)"
            : dept.rank === 3 ? "var(--rank-bronze)"
            : "var(--apex-surface)";
          const rankColor = dept.rank <= 3 ? "white" : "var(--apex-text-muted)";
          const rankBorder = dept.rank > 3 ? "1px solid var(--apex-border)" : "none";

          return (
            <div
              key={dept.shortName}
              className="rounded-xl px-2.5 py-2"
              style={{
                background: isCurrent
                  ? "var(--apex-success-bg)"
                  : isFirst
                    ? "var(--orange-50)"
                    : "var(--apex-bg)",
                border: isCurrent
                  ? `1px solid rgba(var(--apex-primary-rgb), 0.15)`
                  : isFirst
                    ? `1px solid rgba(var(--orange-500-rgb), 0.15)`
                    : "1px solid var(--apex-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: rankBg, color: rankColor, border: rankBorder }}
                >
                  {dept.rank}
                </div>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dept.color }} />
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <span className="text-[11px] font-semibold truncate" style={{ color: "var(--apex-text)" }}>
                    {dept.shortName}
                  </span>
                  {isCurrent && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: "var(--apex-success-bg)",
                        color: "var(--apex-primary)",
                        border: `1px solid rgba(var(--apex-primary-rgb), 0.2)`,
                      }}
                    >
                      Мой
                    </span>
                  )}
                  {isFirst && !isCurrent && <span className="text-[10px] flex-shrink-0">👑</span>}
                </div>
                <span
                  className="text-[13px] font-bold flex-shrink-0"
                  style={{
                    color: isFirst ? "var(--orange-500)" : isCurrent ? "var(--apex-primary)" : "var(--apex-text)",
                  }}
                >
                  {metric}{metricSuffix}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--apex-border)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${maxMetric > 0 ? Math.round((metric / maxMetric) * 100) : 0}%`,
                      background: isFirst ? "var(--orange-500)" : isCurrent ? "var(--apex-primary)" : dept.color,
                      opacity: isCurrent || isFirst ? 1 : 0.65,
                    }}
                  />
                </div>
                <span className="text-[9px] flex-shrink-0" style={{ color: "var(--apex-text-muted)" }}>
                  {using}/{dept.totalEmployees}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gap to leader */}
      {currentDept && currentRank !== 1 && (
        <div
          className="pt-2.5 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--apex-border)" }}
        >
          <div className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>
            До лидера ({leader.shortName})
          </div>
          <div
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: "var(--orange-50)",
              color: "var(--tag-orange-text)",
              border: `1px solid rgba(var(--orange-500-rgb), 0.2)`,
            }}
          >
            −{getMetric(leader) - getMetric(currentDept)}{metricSuffix}
          </div>
        </div>
      )}
      {currentRank === 1 && (
        <div
          className="pt-2.5 flex items-center gap-1.5"
          style={{ borderTop: "1px solid var(--apex-border)" }}
        >
          <span className="text-xs">🎉</span>
          <div className="text-[10px] font-semibold" style={{ color: "var(--apex-primary)" }}>
            Ваш отдел лидирует!
          </div>
        </div>
      )}
    </div>
  );
}

export function DepartmentContest({ departments, automationDepartments, daysLeft }: DepartmentContestProps) {
  const sortedWs = [...departments]
    .sort((a, b) => b.wsPercent - a.wsPercent)
    .map((d, i) => ({ ...d, rank: i + 1 }));

  const autoSource = automationDepartments ?? departments;
  const sortedAuto = [...autoSource]
    .sort((a, b) => b.contestScore - a.contestScore)
    .map((d, i) => ({ ...d, rank: i + 1 }));

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--apex-surface)",
        border: "1px solid var(--apex-border)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy size={14} style={{ color: "var(--orange-500)" }} />
          <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--apex-text-muted)" }}>
            Соревнование отделов
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: "var(--orange-50)",
            border: `1px solid rgba(var(--orange-500-rgb), 0.2)`,
          }}
        >
          <Clock size={11} style={{ color: "var(--orange-500)" }} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--orange-500)" }}>
            {daysLeft === 1 ? "1 день" : `${daysLeft} дня`}
          </span>
          <span className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>до конца месяца</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <DisciplineColumn
          title="Worksection"
          icon="📋"
          prize={150}
          metricLabel="% зелёных дней"
          sorted={sortedWs}
          getMetric={(d) => d.wsPercent}
          getUsing={(d) => Math.round((d.wsPercent / 100) * d.totalEmployees)}
          maxMetric={100}
          metricSuffix="%"
          accentColor="var(--apex-primary)"
        />
        <DisciplineColumn
          title="Автоматизации"
          icon="⚡"
          prize={200}
          metricLabel="Баллы с учётом вовлечённости"
          sorted={sortedAuto}
          getMetric={(d) => Math.round(d.contestScore)}
          getUsing={(d) => d.employeesUsing}
          maxMetric={Math.round(sortedAuto[0]?.contestScore ?? 1)}
          metricSuffix=""
          accentColor="var(--orange-500)"
        />
      </div>
    </div>
  );
}
