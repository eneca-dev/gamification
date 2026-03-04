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
        background: "var(--apex-surface)",
        border: "1px solid var(--apex-border)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ background: "var(--apex-primary)" }}
          >
            {user.avatar}
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--apex-text)" }}>
              Здравствуйте, {user.name}!
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--apex-text-secondary)" }}>
              Отличный день для продуктивной работы
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium mb-1" style={{ color: "var(--apex-text-muted)" }}>
            На вашем счету
          </div>
          <CoinStatic amount={user.balance} size="lg" />
          <div className="text-[10px] mt-0.5" style={{ color: "var(--apex-text-muted)" }}>
            Проект-коинов
          </div>
        </div>
      </div>
    </div>
  );
}
