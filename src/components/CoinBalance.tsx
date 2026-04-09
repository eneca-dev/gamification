"use client";

import { useBalance, BALANCE_POLL_INTERVAL } from '@/modules/shop/hooks/useBalance'
import { CoinIcon } from '@/components/CoinIcon'

interface CoinBalanceProps {
  amount: number;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = { sm: "text-sm", md: "text-lg", lg: "text-3xl" };
const coinSizes = { sm: 16, md: 20, lg: 28 };

export function CoinBalance({ amount, size = "md" }: CoinBalanceProps) {
  const formatted = amount.toLocaleString("ru-RU");
  const isNegative = amount < 0;

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${sizeClasses[size]}`}>
      <span style={{ color: isNegative ? "var(--apex-danger)" : "var(--apex-primary)" }}>
        {isNegative ? "" : "+"}{formatted}
      </span>
      <CoinIcon size={coinSizes[size]} className="flex-shrink-0" />
    </span>
  );
}

export function CoinStatic({ amount, size = "md" }: CoinBalanceProps) {
  const formatted = amount.toLocaleString("ru-RU");

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${sizeClasses[size]}`}>
      <span style={{ color: "inherit" }}>{formatted}</span>
      <CoinIcon size={coinSizes[size]} className="flex-shrink-0" />
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
      <span style={{ color: "var(--apex-text)" }}>{formatted}</span>
      <CoinIcon size={coinSizes[size]} className="flex-shrink-0" />
    </span>
  );
}
