"use client";

import { useState } from "react";
import {
  adminEmployees,
  adminEventLog,
  adminStats,
  departmentContest,
  type AdminEmployee,
  type AdminEvent,
  type WsStatus,
} from "@/lib/data";
import {
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Search,
  Filter,
} from "lucide-react";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: accent + "18" }}
        >
          {icon}
        </div>
      </div>
      <div className="text-[26px] font-extrabold leading-none mb-1" style={{ color: "var(--text-primary)" }}>
        {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
      </div>
      <div className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      {sub && (
        <div className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── WS status badge ──────────────────────────────────────────────────────────

function WsStatusBadge({ status }: { status: WsStatus }) {
  const map: Record<WsStatus, { label: string; bg: string; color: string }> = {
    green:    { label: "Зелёный", bg: "var(--apex-success-bg)",              color: "var(--apex-success-text)" },
    red:      { label: "Красный", bg: "rgba(var(--apex-danger-rgb), 0.12)",  color: "var(--apex-danger)" },
    inactive: { label: "Нет данных", bg: "var(--surface)",                   color: "var(--text-muted)" },
  };
  const s = map[status];
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-bold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}22` }}
    >
      {s.label}
    </span>
  );
}

// ─── Event type badge ─────────────────────────────────────────────────────────

function EventTypeBadge({ type }: { type: AdminEvent["type"] }) {
  const map: Record<AdminEvent["type"], { label: string; icon: string; color: string; bg: string }> = {
    earning:     { label: "Начисление",   icon: "🟢", color: "var(--apex-success-text)",                      bg: "var(--apex-success-bg)" },
    penalty:     { label: "Штраф",        icon: "🔴", color: "var(--apex-danger)",                            bg: "rgba(var(--apex-danger-rgb), 0.1)" },
    purchase:    { label: "Покупка",      icon: "🛍️", color: "var(--tag-purple-text)",                        bg: "var(--tag-purple-bg)" },
    achievement: { label: "Достижение",   icon: "🏆", color: "var(--orange-500)",                             bg: "var(--orange-50)" },
    streak:      { label: "Бонус серии",  icon: "🔥", color: "var(--apex-warning-text)",                      bg: "rgba(var(--orange-500-rgb), 0.1)" },
  };
  const s = map[type];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
      style={{ background: s.bg, color: s.color }}
    >
      <span>{s.icon}</span>
      {s.label}
    </span>
  );
}

// ─── Employees table ──────────────────────────────────────────────────────────

function EmployeesTable() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sortKey, setSortKey] = useState<keyof AdminEmployee>("balance");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const departments = ["all", ...Array.from(new Set(adminEmployees.map((e) => e.department)))];

  const filtered = adminEmployees
    .filter((e) => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.department.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === "all" || e.department === deptFilter;
      return matchSearch && matchDept;
    })
    .sort((a, b) => {
      const va = a[sortKey] as number | string;
      const vb = b[sortKey] as number | string;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "desc" ? vb - va : va - vb;
      }
      return sortDir === "desc"
        ? String(vb).localeCompare(String(va), "ru")
        : String(va).localeCompare(String(vb), "ru");
    });

  function toggleSort(key: keyof AdminEmployee) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const SortArrow = ({ k }: { k: keyof AdminEmployee }) =>
    sortKey === k ? (
      <span style={{ color: "var(--apex-primary)" }}>{sortDir === "desc" ? " ↓" : " ↑"}</span>
    ) : null;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Сотрудники
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="pl-7 pr-3 py-1.5 rounded-lg text-[12px] font-medium outline-none"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                width: 160,
              }}
            />
          </div>
          {/* Dept filter */}
          <div className="flex items-center gap-1">
            <Filter size={11} style={{ color: "var(--text-muted)" }} />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="pl-2 pr-2 py-1.5 rounded-lg text-[12px] font-medium outline-none"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d === "all" ? "Все отделы" : d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              {[
                { key: "name" as const,               label: "Сотрудник" },
                { key: "department" as const,          label: "Отдел" },
                { key: "balance" as const,             label: "Баланс" },
                { key: "earnedThisMonth" as const,     label: "Начислено" },
                { key: "penaltiesThisMonth" as const,  label: "Штрафы" },
                { key: "wsStatus" as const,            label: "WS статус" },
                { key: "lastActive" as const,          label: "Активность" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="text-left text-[11px] font-bold uppercase tracking-wider px-4 py-3 cursor-pointer select-none hover:opacity-80 transition-opacity"
                  style={{ color: "var(--text-muted)" }}
                >
                  {label}<SortArrow k={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <tr
                key={emp.id}
                className="transition-colors hover:bg-[rgba(var(--apex-primary-rgb),0.02)]"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ background: emp.avatarColor }}
                    >
                      {emp.avatar}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                        {emp.name}
                      </div>
                      <div className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                        {emp.role}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-bold"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  >
                    {emp.department}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[14px] font-extrabold" style={{ color: "var(--apex-success-text)" }}>
                    {emp.balance.toLocaleString("ru-RU")}
                  </span>
                  <span className="text-[10px] font-medium ml-1" style={{ color: "var(--text-muted)" }}>б</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[13px] font-bold" style={{ color: "var(--apex-primary)" }}>
                    +{emp.earnedThisMonth}
                  </span>
                  <span className="text-[10px] ml-1" style={{ color: "var(--text-muted)" }}>б</span>
                </td>
                <td className="px-4 py-3">
                  {emp.penaltiesThisMonth > 0 ? (
                    <span className="text-[13px] font-bold" style={{ color: "var(--apex-danger)" }}>
                      −{emp.penaltiesThisMonth}
                      <span className="text-[10px] ml-0.5" style={{ color: "var(--text-muted)" }}>б</span>
                    </span>
                  ) : (
                    <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <WsStatusBadge status={emp.wsStatus} />
                </td>
                <td className="px-4 py-3 text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  {emp.lastActive}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
        Показано {filtered.length} из {adminEmployees.length} сотрудников
      </div>
    </div>
  );
}

// ─── Event log ────────────────────────────────────────────────────────────────

function EventLog() {
  const [typeFilter, setTypeFilter] = useState<AdminEvent["type"] | "all">("all");

  const filtered = typeFilter === "all"
    ? adminEventLog
    : adminEventLog.filter((e) => e.type === typeFilter);

  const filterOptions: { value: AdminEvent["type"] | "all"; label: string }[] = [
    { value: "all",         label: "Все события" },
    { value: "earning",     label: "Начисления" },
    { value: "penalty",     label: "Штрафы" },
    { value: "purchase",    label: "Покупки" },
    { value: "achievement", label: "Достижения" },
    { value: "streak",      label: "Бонусы серий" },
  ];

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Лог событий
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className="px-3 py-1 rounded-lg text-[11px] font-bold transition-all duration-150"
              style={{
                background: typeFilter === opt.value
                  ? "var(--apex-primary)"
                  : "var(--surface)",
                color: typeFilter === opt.value ? "white" : "var(--text-secondary)",
                border: typeFilter === opt.value ? "none" : "1px solid var(--border)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              {["Время", "Сотрудник", "Отдел", "Тип", "Событие", "Сумма"].map((h) => (
                <th
                  key={h}
                  className="text-left text-[11px] font-bold uppercase tracking-wider px-4 py-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ev) => (
              <tr
                key={ev.id}
                className="transition-colors hover:bg-[rgba(var(--apex-primary-rgb),0.02)]"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <td className="px-4 py-2.5 text-[11px] font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                  {ev.timestamp}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                      style={{ background: ev.avatarColor }}
                    >
                      {ev.avatar}
                    </div>
                    <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {ev.employee}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  >
                    {ev.department}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <EventTypeBadge type={ev.type} />
                </td>
                <td className="px-4 py-2.5 text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {ev.description}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {ev.amount !== 0 && (
                    <span
                      className="text-[13px] font-extrabold"
                      style={{ color: ev.amount > 0 ? "var(--apex-primary)" : "var(--apex-danger)" }}
                    >
                      {ev.amount > 0 ? "+" : ""}{ev.amount.toLocaleString("ru-RU")}
                      <span className="text-[10px] font-medium ml-0.5" style={{ color: "var(--text-muted)" }}>б</span>
                    </span>
                  )}
                  {ev.amount === 0 && (
                    <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
        Показано {filtered.length} событий
      </div>
    </div>
  );
}

// ─── Department summary ───────────────────────────────────────────────────────

function DepartmentSummary() {
  const deptStats = departmentContest.map((dept) => {
    const emps = adminEmployees.filter((e) => e.department === dept.shortName);
    const totalBalance = emps.reduce((s, e) => s + e.balance, 0);
    const earnedMonth = emps.reduce((s, e) => s + e.earnedThisMonth, 0);
    const penalties = emps.reduce((s, e) => s + e.penaltiesThisMonth, 0);
    const redCount = emps.filter((e) => e.wsStatus === "red").length;
    return { ...dept, emps: emps.length, totalBalance, earnedMonth, penalties, redCount };
  }).sort((a, b) => b.totalBalance - a.totalBalance);

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
        По отделам
      </div>
      <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              {["Отдел", "Сотр.", "Баллов в обороте", "Начислено за месяц", "Штрафы", "Красных дней", "WS %", "Авт. %"].map((h) => (
                <th
                  key={h}
                  className="text-left text-[11px] font-bold uppercase tracking-wider px-4 py-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deptStats.map((dept) => (
              <tr
                key={dept.shortName}
                className="transition-colors hover:bg-[rgba(var(--apex-primary-rgb),0.02)]"
                style={{
                  borderTop: "1px solid var(--border)",
                  background: dept.isCurrentDepartment ? "rgba(var(--apex-primary-rgb), 0.03)" : undefined,
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dept.color }} />
                    <span className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>
                      {dept.shortName}
                    </span>
                    {dept.isCurrentDepartment && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--apex-success-bg)", color: "var(--apex-success-text)" }}>Мой</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {dept.emps}
                </td>
                <td className="px-4 py-3">
                  <span className="text-[13px] font-extrabold" style={{ color: "var(--apex-success-text)" }}>
                    {dept.totalBalance.toLocaleString("ru-RU")}
                  </span>
                  <span className="text-[10px] ml-1" style={{ color: "var(--text-muted)" }}>б</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[13px] font-bold" style={{ color: "var(--apex-primary)" }}>
                    +{dept.earnedMonth}
                  </span>
                  <span className="text-[10px] ml-1" style={{ color: "var(--text-muted)" }}>б</span>
                </td>
                <td className="px-4 py-3">
                  {dept.penalties > 0 ? (
                    <span className="text-[13px] font-bold" style={{ color: "var(--apex-danger)" }}>
                      −{dept.penalties}
                      <span className="text-[10px] ml-0.5" style={{ color: "var(--text-muted)" }}>б</span>
                    </span>
                  ) : (
                    <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {dept.redCount > 0 ? (
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-bold"
                      style={{ background: "rgba(var(--apex-danger-rgb), 0.1)", color: "var(--apex-danger)" }}
                    >
                      {dept.redCount} чел.
                    </span>
                  ) : (
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-bold"
                      style={{ background: "var(--apex-success-bg)", color: "var(--apex-success-text)" }}
                    >
                      0
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${dept.wsPercent}%`, background: "var(--apex-info-text)" }}
                      />
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: "var(--apex-info-text)" }}>{dept.wsPercent}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${dept.usagePercent}%`, background: "var(--apex-warning-text)" }}
                      />
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: "var(--apex-warning-text)" }}>{dept.usagePercent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              Админ-панель
            </h1>
            <span
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: "var(--tag-gray-bg)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              ⚙️ Только для администраторов
            </span>
          </div>
          <p className="text-sm font-medium mt-1" style={{ color: "var(--text-secondary)" }}>
            Статистика системы, сотрудники и лог событий
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 animate-fade-in-up stagger-1">
        <StatCard
          label="Сотрудников"
          value={adminStats.totalEmployees}
          sub={`Активных сегодня: ${adminStats.activeToday}`}
          icon={<Users size={16} style={{ color: "var(--apex-info-text)" }} />}
          accent="var(--apex-info-text)"
        />
        <StatCard
          label="Баллов в обороте"
          value={adminStats.totalBalanceInCirculation}
          sub="Суммарный баланс всех"
          icon={<Activity size={16} style={{ color: "var(--apex-primary)" }} />}
          accent="var(--apex-primary)"
        />
        <StatCard
          label="Начислено в феврале"
          value={adminStats.issuedThisMonth}
          sub={`Потрачено: ${adminStats.spentThisMonth.toLocaleString("ru-RU")} б`}
          icon={<TrendingUp size={16} style={{ color: "var(--orange-500)" }} />}
          accent="var(--orange-500)"
        />
        <StatCard
          label="Штрафов в феврале"
          value={adminStats.penaltiesThisMonth}
          sub={`Красных дней: ${adminStats.redDaysThisMonth}`}
          icon={<TrendingDown size={16} style={{ color: "var(--apex-danger)" }} />}
          accent="var(--apex-danger)"
        />
      </div>

      {/* Employees table */}
      <div className="animate-fade-in-up stagger-2">
        <EmployeesTable />
      </div>

      {/* Event log + Department summary side by side */}
      <div className="grid grid-cols-5 gap-5 animate-fade-in-up stagger-3">
        <div className="col-span-3">
          <EventLog />
        </div>
        <div className="col-span-2">
          <DepartmentSummary />
        </div>
      </div>
    </div>
  );
}
