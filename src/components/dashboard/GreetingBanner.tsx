"use client";

import { CoinStatic } from "@/components/CoinBalance";

interface GreetingBannerProps {
  user: {
    name: string;
    avatar: string;
    balance: number;
  };
}

export function GreetingBanner({ user }: GreetingBannerProps) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "linear-gradient(135deg, rgba(76,175,80,0.06) 0%, rgba(102,187,106,0.02) 100%)",
        border: "1px solid rgba(76,175,80,0.1)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
            style={{
              background: "linear-gradient(135deg, #4CAF50, #2e7d32)",
              boxShadow: "0 4px 12px rgba(76,175,80,0.3)",
            }}
          >
            {user.avatar}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              Здравствуйте, {user.name}!
            </h1>
            <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Отличный день для продуктивной работы
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
            На вашем счету
          </div>
          <CoinStatic amount={user.balance} size="lg" />
          <div className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
            Проект-коинов
          </div>
        </div>
      </div>
    </div>
  );
}
