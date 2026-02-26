"use client";

import {
  balanceHistory,
  incomeSourcesData,
  achievements,
  operationsHistory,
} from "@/lib/data";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

function BalanceChart() {
  return (
    <div
      className="rounded-2xl p-5 animate-fade-in-up stagger-1"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
        Накопление баллов
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={balanceHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4CAF50" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#4CAF50" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#b2bec3", fontFamily: "Nunito" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#b2bec3", fontFamily: "Nunito" }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e8ede8",
              boxShadow: "0 4px 16px rgba(76,175,80,0.08)",
              fontFamily: "Nunito",
              fontSize: "13px",
            }}
            formatter={(value) => [`${Number(value).toLocaleString("ru-RU")} баллов`, "Баланс"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#4CAF50"
            strokeWidth={3}
            dot={{
              r: 5,
              fill: "#4CAF50",
              stroke: "#fff",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 7,
              fill: "#4CAF50",
              stroke: "#fff",
              strokeWidth: 3,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function IncomeSourcesChart() {
  return (
    <div
      className="rounded-2xl p-5 animate-fade-in-up stagger-2"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
        Источники дохода
      </div>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={incomeSourcesData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={72}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {incomeSourcesData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-3">
          {incomeSourcesData.map((source) => (
            <div key={source.name} className="flex items-center gap-2.5">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: source.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {source.name}
                </div>
              </div>
              <span className="text-[13px] font-extrabold" style={{ color: "var(--green-700)" }}>
                {source.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const achievementGroups = [
  {
    label: "Worksection — Дисциплина",
    color: "#1976d2",
    bg: "rgba(33,150,243,0.08)",
    ids: [1, 2, 3],
  },
  {
    label: "Revit — Техническая эффективность",
    color: "#e65100",
    bg: "rgba(255,152,0,0.08)",
    ids: [4, 5, 6],
  },
  {
    label: "Корпоративная культура",
    color: "#7b1fa2",
    bg: "rgba(156,39,176,0.08)",
    ids: [7, 8, 9],
  },
];

function AchievementCard({ ach }: { ach: (typeof achievements)[0] }) {
  return (
    <div className={`achievement-badge ${ach.earned ? "earned" : "locked"} group relative`}>
      <div
        className="flex flex-col items-center p-3 rounded-xl transition-all cursor-default"
        style={{
          background: ach.earned
            ? "linear-gradient(135deg, var(--green-50), rgba(76,175,80,0.05))"
            : "var(--surface)",
          border: ach.earned ? "1px solid var(--green-200)" : "1px solid var(--border)",
        }}
      >
        <span className="text-2xl mb-1">{ach.icon}</span>
        <span
          className="text-[10px] font-bold text-center leading-tight"
          style={{ color: ach.earned ? "var(--green-700)" : "var(--text-muted)" }}
        >
          {ach.name}
        </span>
        {ach.earned && ach.date && (
          <span className="text-[9px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
            {ach.date}
          </span>
        )}
      </div>

      {/* Tooltip */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-[11px] font-medium w-52 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
        style={{
          background: "var(--text-primary)",
          color: "white",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {ach.description}
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
          style={{ background: "var(--text-primary)" }}
        />
      </div>
    </div>
  );
}

function AchievementsWall() {
  const earned = achievements.filter((a) => a.earned);

  return (
    <div
      className="rounded-2xl p-5 animate-fade-in-up stagger-3"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Стена достижений
        </div>
        <span
          className="text-[12px] font-bold px-2.5 py-0.5 rounded-full"
          style={{ background: "var(--green-100)", color: "var(--green-700)" }}
        >
          {earned.length} / {achievements.length}
        </span>
      </div>

      <div className="space-y-5">
        {achievementGroups.map((group) => {
          const groupAchs = achievements.filter((a) => group.ids.includes(a.id));
          return (
            <div key={group.label}>
              <div
                className="text-[11px] font-bold uppercase tracking-wider mb-3 px-2.5 py-1 rounded-lg inline-block"
                style={{ color: group.color, background: group.bg }}
              >
                {group.label}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {groupAchs.map((ach) => (
                  <AchievementCard key={ach.id} ach={ach} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OperationsTable() {
  return (
    <div
      className="rounded-2xl p-5 animate-fade-in-up stagger-4"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
        История операций
      </div>
      <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              <th
                className="text-left text-[11px] font-bold uppercase tracking-wider px-4 py-3"
                style={{ color: "var(--text-muted)" }}
              >
                Дата
              </th>
              <th
                className="text-left text-[11px] font-bold uppercase tracking-wider px-4 py-3"
                style={{ color: "var(--text-muted)" }}
              >
                Операция
              </th>
              <th
                className="text-right text-[11px] font-bold uppercase tracking-wider px-4 py-3"
                style={{ color: "var(--text-muted)" }}
              >
                Сумма
              </th>
            </tr>
          </thead>
          <tbody>
            {operationsHistory.map((op, i) => (
              <tr
                key={i}
                className="transition-colors hover:bg-[rgba(76,175,80,0.02)]"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <td className="px-4 py-3 text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  {op.date}
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {op.operation}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className="text-[13px] font-extrabold"
                    style={{
                      color: op.amount > 0 ? "var(--green-600)" : "#e53935",
                    }}
                  >
                    {op.amount > 0 ? "+" : ""}
                    {op.amount.toLocaleString("ru-RU")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
          Мои достижения
        </h1>
        <p className="text-sm font-medium mt-1" style={{ color: "var(--text-secondary)" }}>
          Аналитика и прогресс вашей активности
        </p>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-2 gap-5">
        <BalanceChart />
        <IncomeSourcesChart />
      </div>

      {/* Achievements wall */}
      <AchievementsWall />

      {/* Operations table */}
      <OperationsTable />
    </div>
  );
}
