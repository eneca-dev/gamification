"use client";

import { useBalance, BALANCE_POLL_INTERVAL } from '@/modules/shop/hooks/useBalance'

interface CoinBalanceProps {
  amount: number;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = { sm: "text-sm", md: "text-lg", lg: "text-3xl" };
const coinSizeClasses = {
  sm: "w-4 h-4 text-[9px]",
  md: "w-5 h-5 text-[10px]",
  lg: "w-7 h-7 text-[13px]",
};

export function CoinBalance({ amount, size = "md" }: CoinBalanceProps) {
  const formatted = amount.toLocaleString("ru-RU");
  const isNegative = amount < 0;

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${sizeClasses[size]}`}>
      <span
        className={`${coinSizeClasses[size]} rounded-full flex items-center justify-center text-white flex-shrink-0`}
        style={{ background: isNegative ? "var(--apex-danger)" : "var(--apex-primary)" }}
      >
        Б
      </span>
      <span style={{ color: isNegative ? "var(--apex-danger)" : "var(--apex-primary)" }}>
        {isNegative ? "" : "+"}{formatted}
      </span>
    </span>
  );
}

export function CoinStatic({ amount, size = "md" }: CoinBalanceProps) {
  const formatted = amount.toLocaleString("ru-RU");

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${sizeClasses[size]}`}>
      <span
        className={`${coinSizeClasses[size]} rounded-full flex items-center justify-center text-white flex-shrink-0`}
        style={{ background: "var(--apex-primary)" }}
      >
        Б
      </span>
      <span style={{ color: "var(--apex-text)" }}>{formatted}</span>
    </span>
  );
}

interface CoinBalanceLiveProps {
  initialAmount: number;
  size?: "sm" | "md" | "lg";
}

export function CoinBalanceLive({ initialAmount, size = "md" }: CoinBalanceLiveProps) {
  const { data } = useBalance({ refetchInterval: BALANCE_POLL_INTERVAL })
  const amount = data ?? initialAmount
  const formatted = amount.toLocaleString("ru-RU");

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${sizeClasses[size]}`}>
      <span
        className={`${coinSizeClasses[size]} rounded-full flex items-center justify-center text-white flex-shrink-0`}
        style={{ background: "var(--apex-primary)" }}
      >
        Б
      </span>
      <span style={{ color: "var(--apex-text)" }}>{formatted}</span>
    </span>
  );
}
