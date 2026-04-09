import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";

import { getCurrentUser } from "@/modules/auth/queries";
import { getMasterPlannerPanel, getMasterPlannerHistory } from "@/modules/master-planner";
import { MasterPlannerHistory } from "@/modules/master-planner/components/MasterPlannerHistory";

const PAGE_SIZE = 20;

interface MasterPlannerPageProps {
  searchParams: Promise<{ page?: string; level?: string }>;
}

export default async function MasterPlannerPage({ searchParams }: MasterPlannerPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const levelFilter = params.level === "L3" || params.level === "L2" ? params.level : undefined;

  const currentUser = await getCurrentUser();
  const wsUserId = currentUser?.wsUserId;

  if (!wsUserId) {
    return (
      <div className="text-center py-12" style={{ color: "var(--apex-text-muted)" }}>
        Нет данных Worksection
      </div>
    );
  }

  const [panelData, historyData] = await Promise.all([
    getMasterPlannerPanel(wsUserId),
    getMasterPlannerHistory(wsUserId, currentPage, levelFilter),
  ]);

  const totalPages = Math.ceil(historyData.totalCount / PAGE_SIZE);

  // Строим URL для пагинации с сохранением фильтра
  function pageUrl(page: number) {
    const p = new URLSearchParams();
    p.set("page", String(page));
    if (levelFilter) p.set("level", levelFilter);
    return `/master-planner?${p.toString()}`;
  }

  function levelUrl(level?: string) {
    const p = new URLSearchParams();
    if (level) p.set("level", level);
    return `/master-planner?${p.toString()}`;
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
          <div className="flex items-center gap-3 mb-6">
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
                <span className="text-[12px]" style={{ color: "var(--apex-text-muted)" }}>
                  L3: {panelData.l3.currentStreak % 10}/10
                  {panelData.l3.completedCycles > 0 && (
                    <span
                      className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: "var(--apex-success-bg)", color: "var(--apex-primary)" }}
                    >
                      {panelData.l3.completedCycles}x +{panelData.l3.reward}
                    </span>
                  )}
                </span>
                <span className="text-[12px]" style={{ color: "var(--apex-text-muted)" }}>
                  L2: {panelData.l2.currentStreak % 10}/10
                  {panelData.l2.completedCycles > 0 && (
                    <span
                      className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: "var(--orange-50)", color: "var(--orange-500)" }}
                    >
                      {panelData.l2.completedCycles}x +{panelData.l2.reward}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Табы */}
          <div className="flex gap-1 mb-4">
            {[
              { label: "Все", value: undefined },
              { label: "L3", value: "L3" },
              { label: "L2", value: "L2" },
            ].map((tab) => {
              const isActive = levelFilter === tab.value;
              return (
                <a
                  key={tab.label}
                  href={levelUrl(tab.value)}
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
            <span className="ml-auto text-[12px] font-medium self-center" style={{ color: "var(--apex-text-muted)" }}>
              {historyData.totalCount} {pluralize(historyData.totalCount)}
            </span>
          </div>

          {/* Таблица */}
          {historyData.events.length > 0 ? (
            <MasterPlannerHistory
              events={historyData.events}
              startPosition={historyData.startPosition}
            />
          ) : (
            <div className="text-center py-8 text-[13px]" style={{ color: "var(--apex-text-muted)" }}>
              Нет событий
            </div>
          )}

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {currentPage > 1 && (
                <a
                  href={pageUrl(currentPage - 1)}
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
                  href={pageUrl(currentPage + 1)}
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
