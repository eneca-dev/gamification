import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getCurrentUser } from "@/modules/auth/queries";
import { getUserTransactions, getUserTransactionsCount, getEventIcon } from "@/modules/transactions";
import { TransactionsList } from "@/modules/transactions/components/TransactionsList";
import { TransactionsFilters, SortToggle } from "@/modules/transactions/components/TransactionsFilters";
import type { TransactionFilters } from "@/modules/transactions";

const PAGE_SIZE = 30;

interface TransactionsPageProps {
  searchParams: Promise<{ page?: string; sort?: string; source?: string; date_from?: string; date_to?: string }>;
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const sort = (params.sort === 'date_asc' ? 'date_asc' : 'date_desc') satisfies TransactionFilters['sort'];
  const source = params.source ?? 'all';
  const dateFrom = params.date_from ?? '';
  const dateTo = params.date_to ?? '';

  const filters: TransactionFilters = { sort, source, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };

  const currentUser = await getCurrentUser();
  const userEmail = currentUser?.email ?? "";

  const [transactions, totalCount] = await Promise.all([
    userEmail ? getUserTransactions(userEmail, PAGE_SIZE, offset, filters) : Promise.resolve([]),
    userEmail ? getUserTransactionsCount(userEmail, filters) : Promise.resolve(0),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const items = transactions.map((tx) => ({
    ...tx,
    icon: getEventIcon(tx.event_type),
    dateFormatted: new Date(tx.event_date + "T00:00:00").toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  }));

  const paginationBase = new URLSearchParams({
    sort,
    ...(source !== 'all' && { source }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
  }).toString();

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
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-[18px] font-bold" style={{ color: "var(--apex-text)" }}>
              Все операции
            </h1>
            <div className="flex items-center gap-3">
              <SortToggle
                currentSort={sort}
                currentSource={source}
                currentDateFrom={dateFrom}
                currentDateTo={dateTo}
              />
              <span className="text-[12px] font-medium" style={{ color: "var(--apex-text-muted)" }}>
                {totalCount} {pluralize(totalCount)}
              </span>
            </div>
          </div>

          <Suspense fallback={<FiltersSkeleton />}>
            <TransactionsFilters
              currentSort={sort}
              currentSource={source}
              currentDateFrom={dateFrom}
              currentDateTo={dateTo}
            />
          </Suspense>

          <TransactionsList items={items} />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-6">
              {currentPage > 1 && (
                <>
                  <a
                    href={`/transactions?page=1&${paginationBase}`}
                    aria-label="К первой странице"
                    title="К первой странице"
                    className="flex items-center justify-center transition-colors"
                    style={{ color: "var(--apex-text-muted)" }}
                  >
                    <ChevronsLeft size={16} />
                  </a>
                  <a
                    href={`/transactions?page=${currentPage - 1}&${paginationBase}`}
                    aria-label="Предыдущая страница"
                    title="Предыдущая страница"
                    className="flex items-center justify-center transition-colors"
                    style={{ color: "var(--apex-text-muted)" }}
                  >
                    <ChevronLeft size={16} />
                  </a>
                </>
              )}
              <span className="text-[12px] font-medium px-3" style={{ color: "var(--apex-text-muted)" }}>
                {currentPage} / {totalPages}
              </span>
              {currentPage < totalPages && (
                <>
                  <a
                    href={`/transactions?page=${currentPage + 1}&${paginationBase}`}
                    aria-label="Следующая страница"
                    title="Следующая страница"
                    className="flex items-center justify-center transition-colors"
                    style={{ color: "var(--apex-text-muted)" }}
                  >
                    <ChevronRight size={16} />
                  </a>
                  <a
                    href={`/transactions?page=${totalPages}&${paginationBase}`}
                    aria-label="К последней странице"
                    title="К последней странице"
                    className="flex items-center justify-center transition-colors"
                    style={{ color: "var(--apex-text-muted)" }}
                  >
                    <ChevronsRight size={16} />
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="space-y-2.5 pb-4 mb-2">
      <div className="flex items-center gap-3">
        <div className="h-3 w-14 rounded animate-pulse flex-shrink-0" style={{ background: '#E5E7EB' }} />
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }).map((_, j) => (
            <div key={j} className="h-6 w-20 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-3 w-14 rounded animate-pulse flex-shrink-0" style={{ background: '#E5E7EB' }} />
        <div className="h-6 w-28 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
      </div>
    </div>
  );
}

function pluralize(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return "операций";
  if (mod10 === 1) return "операция";
  if (mod10 >= 2 && mod10 <= 4) return "операции";
  return "операций";
}
