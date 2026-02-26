"use client";

interface CoinBalanceProps {
  amount: number;
  size?: "sm" | "md" | "lg";
}

export function CoinBalance({ amount, size = "md" }: CoinBalanceProps) {
  const formatted = amount.toLocaleString("ru-RU");
  const isNegative = amount < 0;

  const sizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-3xl",
  };

  const coinSizeClasses = {
    sm: "w-4 h-4 text-[9px]",
    md: "w-5 h-5 text-[10px]",
    lg: "w-7 h-7 text-[13px]",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-extrabold ${sizeClasses[size]}`}>
      <span
        className={`${coinSizeClasses[size]} rounded-full flex items-center justify-center text-white flex-shrink-0`}
        style={{
          background: isNegative
            ? "linear-gradient(135deg, #ef5350, #e53935)"
            : "linear-gradient(135deg, #66bb6a, #43a047)",
          boxShadow: isNegative
            ? "0 1px 3px rgba(239,83,80,0.3)"
            : "0 1px 3px rgba(76,175,80,0.3)",
        }}
      >
        П
      </span>
      <span style={{ color: isNegative ? "#e53935" : "var(--green-700)" }}>
        {isNegative ? "" : "+"}{formatted}
      </span>
    </span>
  );
}

export function CoinStatic({ amount, size = "md" }: CoinBalanceProps) {
  const formatted = amount.toLocaleString("ru-RU");

  const sizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-3xl",
  };

  const coinSizeClasses = {
    sm: "w-4 h-4 text-[9px]",
    md: "w-5 h-5 text-[10px]",
    lg: "w-7 h-7 text-[13px]",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-extrabold ${sizeClasses[size]}`}>
      <span
        className={`${coinSizeClasses[size]} rounded-full flex items-center justify-center text-white flex-shrink-0`}
        style={{
          background: "linear-gradient(135deg, #66bb6a, #43a047)",
          boxShadow: "0 1px 3px rgba(76,175,80,0.3)",
        }}
      >
        П
      </span>
      <span style={{ color: "var(--text-primary)" }}>{formatted}</span>
    </span>
  );
}
