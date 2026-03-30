import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/modules/auth/queries";
import { getUserTransactions, getUserTransactionsCount, getEventIcon } from "@/modules/transactions";
import { TransactionsList } from "@/modules/transactions/components/TransactionsList";

const PAGE_SIZE = 30;

interface TransactionsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const currentUser = await getCurrentUser();
  const userEmail = currentUser?.email ?? "";

  const [transactions, totalCount] = await Promise.all([
    userEmail ? getUserTransactions(userEmail, PAGE_SIZE, offset) : Promise.resolve([]),
    userEmail ? getUserTransactionsCount(userEmail) : Promise.resolve(0),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const items = transactions.map((tx) => ({
    ...tx,
    icon: getEventIcon(tx.event_type),
    dateFormatted: new Date(tx.event_date + "T00:00:00").toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }));

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
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-[18px] font-bold" style={{ color: "var(--apex-text)" }}>
              Все операции
            </h1>
            <span className="text-[12px] font-medium" style={{ color: "var(--apex-text-muted)" }}>
              {totalCount} {pluralize(totalCount)}
            </span>
          </div>

          <TransactionsList items={items} />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {currentPage > 1 && (
                <a
                  href={`/transactions?page=${currentPage - 1}`}
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
                  href={`/transactions?page=${currentPage + 1}`}
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
  if (mod100 >= 11 && mod100 <= 14) return "операций";
  if (mod10 === 1) return "операция";
  if (mod10 >= 2 && mod10 <= 4) return "операции";
  return "операций";
}
