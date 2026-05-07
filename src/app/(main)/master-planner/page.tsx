import Link from "next/link";
import { ArrowLeft, Trophy, Clock, ExternalLink, CalendarCheck } from "lucide-react";

import { getCurrentUser } from "@/modules/auth/queries";
import { getMasterPlannerPanel, getMasterPlannerHistory, getAllPendingTasks, getAllDeadlinePendingTasks } from "@/modules/master-planner";
import { MasterPlannerHistory } from "@/modules/master-planner/components/MasterPlannerHistory";

import type { HistoryStatusFilter } from "@/modules/master-planner";
import type { PendingBudgetTask } from "@/modules/master-planner";

const PAGE_SIZE = 20;

const VALID_STATUSES = new Set<string>(["pending", "ok", "exceeded", "revoked"]);
const VALID_PENDING_TYPES = new Set<string>(["budget", "deadline"]);

interface MasterPlannerPageProps {
  searchParams: Promise<{ page?: string; level?: string; status?: string; pendingType?: string }>;
}

export default async function MasterPlannerPage({ searchParams }: MasterPlannerPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const levelFilter = params.level === "L3" || params.level === "L2" ? params.level : undefined;
  const statusFilter = VALID_STATUSES.has(params.status ?? "") ? params.status as HistoryStatusFilter | "pending" : undefined;
  const pendingTypeFilter = VALID_PENDING_TYPES.has(params.pendingType ?? "") ? params.pendingType as "budget" | "deadline" : undefined;

  const currentUser = await getCurrentUser();
  const wsUserId = currentUser?.wsUserId;

  if (!wsUserId) {
    return (
      <div className="text-center py-12" style={{ color: "var(--apex-text-muted)" }}>
        Нет данных Worksection
      </div>
    );
  }

  const isPending = statusFilter === "pending";
  const historyStatus = isPending ? undefined : statusFilter as HistoryStatusFilter | undefined;

  // Загружаем данные в зависимости от режима
  const [panelData, historyData, pendingTasks] = await Promise.all([
    getMasterPlannerPanel(wsUserId),
    isPending
      ? Promise.resolve({ events: [], totalCount: 0, startPosition: 0 })
      : getMasterPlannerHistory(wsUserId, currentPage, levelFilter, historyStatus),
    isPending
      ? (async (): Promise<PendingBudgetTask[]> => {
          if (pendingTypeFilter === "budget") {
            return getAllPendingTasks(wsUserId, levelFilter);
          }
          if (pendingTypeFilter === "deadline") {
            return getAllDeadlinePendingTasks(wsUserId);
          }
          // Оба типа: объединяем и сортируем
          const [budget, deadline] = await Promise.all([
            getAllPendingTasks(wsUserId, levelFilter),
            getAllDeadlinePendingTasks(wsUserId),
          ]);
          return [...budget, ...deadline].sort((a, b) => a.daysRemaining - b.daysRemaining);
        })()
      : Promise.resolve([] as PendingBudgetTask[]),
  ]);

  const totalPages = isPending ? 0 : Math.ceil(historyData.totalCount / PAGE_SIZE);

  function buildUrl(overrides: { page?: number; level?: string; status?: string; pendingType?: string }) {
    const p = new URLSearchParams();
    const pg = overrides.page ?? (overrides.status !== undefined || overrides.level !== undefined ? undefined : currentPage);
    if (pg && pg > 1) p.set("page", String(pg));
    const lv = overrides.level !== undefined ? overrides.level : levelFilter;
    if (lv) p.set("level", lv);
    const st = overrides.status !== undefined ? overrides.status : statusFilter;
    if (st) p.set("status", st);
    const pt = overrides.pendingType !== undefined ? overrides.pendingType : (overrides.status === "pending" ? pendingTypeFilter : undefined);
    if (pt) p.set("pendingType", pt);
    const qs = p.toString();
    return `/master-planner${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
        style={{ color: "var(--apex-text-muted)" }}
      >
        <ArrowLeft size={15} />
        На главную
      </Link>

      <div className="animate-fade-in-up">
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--apex-surface)", border: "1px solid var(--apex-border)" }}
        >
          {/* Шапка */}
          <div className="flex items-center gap-3 mb-6" data-onboarding="mp-header">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "var(--apex-success-bg)" }}
            >
              <Trophy size={18} style={{ color: "var(--apex-primary)" }} />
            </div>
            <div>
              <h1 className="text-[18px] font-bold" style={{ color: "var(--apex-text)" }}>
                Мастер планирования
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-[12px]" title="Задачи 3-го уровня. Серия считается только по задачам с бюджетом">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-default"
                    style={{ background: "var(--teal-100)", color: "var(--apex-primary)" }}
                  >
                    L3
                  </span>
                  <span style={{ color: "var(--apex-text)" }}>
                    {panelData.l3.currentStreak % 10}/10
                  </span>
                  {panelData.l3.completedCycles > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: "var(--apex-success-bg)", color: "var(--apex-primary)" }}
                    >
                      {panelData.l3.completedCycles}x +{panelData.l3.reward}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-[12px]" title="Задачи 2-го уровня. Серия считается только по задачам с бюджетом">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-default"
                    style={{ background: "var(--orange-50)", color: "var(--orange-500)" }}
                  >
                    L2
                  </span>
                  <span style={{ color: "var(--apex-text)" }}>
                    {panelData.l2.currentStreak % 10}/10
                  </span>
                  {panelData.l2.completedCycles > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: "var(--orange-50)", color: "var(--orange-500)" }}
                    >
                      {panelData.l2.completedCycles}x +{panelData.l2.reward}
                    </span>
                  )}
                </span>
                <span className="text-[11px]" style={{ color: "var(--apex-text-muted)" }}>
                  💲 серии только по бюджету
                </span>
              </div>
            </div>
          </div>

          {/* Ряд 1: фильтр по уровню (скрываем при deadline-only pending) */}
          {!(isPending && pendingTypeFilter === "deadline") && (
            <div className="flex gap-1 mb-2" data-onboarding="mp-filters">
              {[
                { label: "Все", value: undefined },
                { label: "L3", value: "L3" },
                { label: "L2", value: "L2" },
              ].map((tab) => {
                const isActive = levelFilter === tab.value;
                return (
                  <a
                    key={tab.label}
                    href={buildUrl({ level: tab.value ?? "" })}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
                    style={{
                      background: isActive ? "var(--apex-primary)" : "var(--apex-bg)",
                      color: isActive ? "white" : "var(--apex-text-muted)",
                      border: isActive ? "none" : "1px solid var(--apex-border)",
                    }}
                  >
                    {tab.label}
                  </a>
                );
              })}
            </div>
          )}

          {/* Ряд 2: фильтр по статусу */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1 overflow-x-auto flex-nowrap flex-1 min-w-0 pb-0.5">
              {[
                { label: "Все события", value: undefined },
                { label: "Ожидают 30 дней", value: "pending" },
                { label: "Закрыта в бюджете", value: "ok" },
                { label: "Превышение бюджета", value: "exceeded" },
                { label: "Отозвано", value: "revoked" },
              ].map((tab) => {
                const isActive = statusFilter === tab.value;
                return (
                  <a
                    key={tab.label}
                    href={buildUrl({ status: tab.value ?? "", pendingType: "" })}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors shrink-0"
                    style={{
                      background: isActive ? "var(--apex-text)" : "var(--apex-bg)",
                      color: isActive ? "var(--apex-surface)" : "var(--apex-text-muted)",
                      border: isActive ? "none" : "1px solid var(--apex-border)",
                    }}
                  >
                    {tab.label}
                  </a>
                );
              })}
            </div>
            {!isPending && (
              <span className="shrink-0 text-[12px] font-medium" style={{ color: "var(--apex-text-muted)" }}>
                {historyData.totalCount} {pluralize(historyData.totalCount)}
              </span>
            )}
            {isPending && (
              <span className="shrink-0 text-[12px] font-medium" style={{ color: "var(--apex-text-muted)" }}>
                {pendingTasks.length} {pluralizeTask(pendingTasks.length)}
              </span>
            )}
          </div>

          {/* Ряд 3: суб-фильтр по типу (только в режиме "Ожидают 30 дней") */}
          {isPending && (
            <div className="flex gap-1 mb-4">
              {[
                { label: "Все типы", value: undefined },
                { label: "💲 Бюджет", value: "budget" },
                { label: "⏳ Срок", value: "deadline" },
              ].map((tab) => {
                const isActive = pendingTypeFilter === tab.value;
                return (
                  <a
                    key={tab.label}
                    href={buildUrl({ pendingType: tab.value ?? "" })}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
                    style={{
                      background: isActive ? "var(--apex-text)" : "var(--apex-bg)",
                      color: isActive ? "var(--apex-surface)" : "var(--apex-text-muted)",
                      border: isActive ? "none" : "1px solid var(--apex-border)",
                    }}
                  >
                    {tab.label}
                  </a>
                );
              })}
            </div>
          )}

          {/* Контент */}
          {isPending ? (
            pendingTasks.length > 0 ? (
              <div className="space-y-0.5">
                {/* Заголовки */}
                <div
                  className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--apex-text-muted)", borderBottom: "1px solid var(--apex-border)" }}
                >
                  <div className="w-8 shrink-0" />
                  <span className="shrink-0 w-4" />
                  <span className="shrink-0 w-6" />
                  <div className="flex-1 min-w-0">Задача</div>
                  {pendingTypeFilter !== "budget" && (
                    <span className="shrink-0 w-20 text-center">Плановая дата</span>
                  )}
                  <span className="shrink-0 text-right">
                    {pendingTypeFilter === "deadline" ? "Вовремя?" : "дней до начисления"}
                  </span>
                </div>

                {pendingTasks.map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background: "var(--apex-bg)" }}
                  >
                    {/* Иконка категории */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--apex-surface)", border: "1px solid var(--apex-border)" }}
                    >
                      {task.category === "budget"
                        ? <Clock size={15} style={{ color: "var(--apex-text-muted)" }} />
                        : <CalendarCheck size={15} style={{ color: "var(--apex-primary)" }} />
                      }
                    </div>

                    {/* Тип задачи 💲/⏳ */}
                    <span
                      className="text-[11px] shrink-0 w-4 text-center"
                      title={task.category === "budget" ? "По бюджету" : "По сроку"}
                    >
                      {task.category === "budget" ? "💲" : "⏳"}
                    </span>

                    {/* Level badge (только для budget или mixed) */}
                    {task.category === "budget" && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background: task.level === "L3" ? "var(--teal-100)" : "var(--orange-50)",
                          color: task.level === "L3" ? "var(--apex-primary)" : "var(--orange-500)",
                        }}
                      >
                        {task.level}
                      </span>
                    )}
                    {task.category === "deadline" && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: "var(--teal-100)", color: "var(--apex-primary)" }}
                      >
                        L3
                      </span>
                    )}

                    {/* Название задачи */}
                    <div className="flex-1 min-w-0">
                      {task.taskUrl ? (
                        <a
                          href={task.taskUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] font-medium hover:underline inline-flex items-center gap-1 min-w-0"
                          style={{ color: "var(--apex-text)" }}
                        >
                          <span className="truncate">{task.taskName}</span>
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      ) : (
                        <span className="text-[12px] font-medium truncate block" style={{ color: "var(--apex-text)" }}>
                          {task.taskName}
                        </span>
                      )}
                    </div>

                    {/* Плановая дата (для deadline и mixed) */}
                    {pendingTypeFilter !== "budget" && (
                      <span className="text-[11px] shrink-0 w-20 text-center" style={{ color: "var(--apex-text-muted)" }}>
                        {task.category === "deadline" && task.plannedEnd
                          ? new Date(task.plannedEnd + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                          : "—"
                        }
                      </span>
                    )}

                    {/* Статус / дни */}
                    {task.category === "deadline" ? (
                      <span
                        className="text-[11px] font-semibold shrink-0"
                        style={{ color: task.closedOnTime ? "var(--apex-primary)" : "var(--apex-danger)" }}
                      >
                        {task.closedOnTime ? "✓ вовремя" : "✗ просрочено"}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--apex-text-muted)" }}>
                        {task.daysRemaining}д
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: "var(--apex-success-bg)" }}
                >
                  <Clock size={24} style={{ color: "var(--apex-primary)" }} />
                </div>
                <span className="text-[13px] font-semibold" style={{ color: "var(--apex-text)" }}>
                  Нет задач, ожидающих проверки
                </span>
                <span className="text-[11px] mt-1" style={{ color: "var(--apex-text-muted)" }}>
                  Когда появятся задачи — они отобразятся здесь
                </span>
              </div>
            )
          ) : historyData.events.length > 0 ? (
            <MasterPlannerHistory
              events={historyData.events}
              startPosition={historyData.startPosition}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: "var(--apex-success-bg)" }}
              >
                <Trophy size={24} style={{ color: "var(--apex-primary)" }} />
              </div>
              <span className="text-[13px] font-semibold" style={{ color: "var(--apex-text)" }}>
                Нет событий
              </span>
              <span className="text-[11px] mt-1" style={{ color: "var(--apex-text-muted)" }}>
                История событий появится после первых задач
              </span>
            </div>
          )}

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {currentPage > 1 && (
                <a
                  href={buildUrl({ page: currentPage - 1 })}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                  style={{ background: "var(--apex-bg)", color: "var(--apex-text)", border: "1px solid var(--apex-border)" }}
                >
                  ← Назад
                </a>
              )}
              <span className="text-[12px] font-medium px-3" style={{ color: "var(--apex-text-muted)" }}>
                {currentPage} / {totalPages}
              </span>
              {currentPage < totalPages && (
                <a
                  href={buildUrl({ page: currentPage + 1 })}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                  style={{ background: "var(--apex-bg)", color: "var(--apex-text)", border: "1px solid var(--apex-border)" }}
                >
                  Вперёд →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function pluralize(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return "событий";
  if (mod10 === 1) return "событие";
  if (mod10 >= 2 && mod10 <= 4) return "события";
  return "событий";
}

function pluralizeTask(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return "задач";
  if (mod10 === 1) return "задача";
  if (mod10 >= 2 && mod10 <= 4) return "задачи";
  return "задач";
}
