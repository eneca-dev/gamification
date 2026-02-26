"use client";

import { useState } from "react";
import { storeProducts, filterTabs, user } from "@/lib/data";
import { CoinStatic } from "@/components/CoinBalance";

export default function StorePage() {
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered =
    activeFilter === "all"
      ? storeProducts
      : storeProducts.filter((p) => p.category === activeFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            Рынок достижений
          </h1>
          <p className="text-sm font-medium mt-1" style={{ color: "var(--text-secondary)" }}>
            Обменивайте коины на реальные награды
          </p>
        </div>
        <div
          className="px-5 py-2.5 rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(76,175,80,0.08), rgba(102,187,106,0.04))",
            border: "1px solid rgba(76,175,80,0.12)",
          }}
        >
          <div className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
            Ваш баланс
          </div>
          <CoinStatic amount={user.balance} size="md" />
        </div>
      </div>

      {/* Raffle banner */}
      <div className="animate-fade-in-up stagger-1">
        <div
          className="rounded-2xl p-5 glass-banner relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(76,175,80,0.1) 0%, rgba(255,152,0,0.06) 100%)",
            border: "1px solid rgba(76,175,80,0.15)",
          }}
        >
          <div
            className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
            style={{
              background: "radial-gradient(circle, var(--orange-400), transparent)",
              transform: "translate(30%, -30%)",
            }}
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255,152,0,0.15), rgba(255,167,38,0.08))",
                  border: "1px solid rgba(255,152,0,0.15)",
                }}
              >
                🎧
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--orange-500)" }}>
                  Розыгрыш месяца
                </div>
                <h3 className="text-lg font-extrabold mt-0.5" style={{ color: "var(--text-primary)" }}>
                  Наушники с шумоподавлением
                </h3>
                <p className="text-[12px] font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Участвуют все, кто приобрёл билет в этом месяце
                </p>
              </div>
            </div>
            <button
              className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, var(--orange-500), var(--orange-400))",
                boxShadow: "0 2px 8px rgba(255,152,0,0.3)",
              }}
            >
              Участвовать за 300 коинов
            </button>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="animate-fade-in-up stagger-2 flex gap-2 flex-wrap">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
              style={{
                background: isActive
                  ? "linear-gradient(135deg, var(--green-500), var(--green-600))"
                  : "var(--surface-elevated)",
                color: isActive ? "white" : "var(--text-secondary)",
                border: isActive ? "none" : "1px solid var(--border)",
                boxShadow: isActive ? "0 2px 8px rgba(76,175,80,0.25)" : "var(--shadow-sm)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Category info banner */}
      {activeFilter === "upgrade" && (
        <div
          className="animate-fade-in-up rounded-xl px-4 py-3 flex items-center gap-3 text-[12px] font-medium"
          style={{
            background: "var(--green-50)",
            border: "1px solid rgba(76,175,80,0.12)",
            color: "var(--text-secondary)",
          }}
        >
          <span className="text-base">ℹ️</span>
          Оборудование из этой категории остаётся собственностью компании
        </div>
      )}
      {activeFilter === "merch" && (
        <div
          className="animate-fade-in-up rounded-xl px-4 py-3 flex items-center gap-3 text-[12px] font-medium"
          style={{
            background: "var(--green-50)",
            border: "1px solid rgba(76,175,80,0.12)",
            color: "var(--text-secondary)",
          }}
        >
          <span className="text-base">🎁</span>
          Товары из этой категории переходят в собственность сотрудника
        </div>
      )}

      {/* Product grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in-up stagger-3">
        {filtered.map((product, i) => {
          const canAfford = user.balance >= product.price;
          const deficit = product.price - user.balance;

          return (
            <div
              key={product.id}
              className={`rounded-2xl overflow-hidden card-hover stagger-${Math.min(i + 1, 6)}`}
              style={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
                animationDelay: `${i * 0.06}s`,
              }}
            >
              {/* Product image area */}
              <div
                className="h-36 product-image-placeholder relative"
              >
                <span className="text-5xl">{product.emoji}</span>
                {product.tag && (
                  <span
                    className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                    style={{
                      background: product.tag === "Премиум"
                        ? "linear-gradient(135deg, var(--orange-500), var(--orange-400))"
                        : product.tag === "Эксклюзив"
                        ? "linear-gradient(135deg, #7c4dff, #651fff)"
                        : "linear-gradient(135deg, var(--green-500), var(--green-400))",
                      color: "white",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    {product.tag}
                  </span>
                )}
              </div>

              {/* Product details */}
              <div className="p-4">
                <h3
                  className="text-[13px] font-bold leading-snug mb-3"
                  style={{ color: "var(--text-primary)", minHeight: "36px" }}
                >
                  {product.name}
                </h3>

                <div className="flex items-center justify-between mb-3">
                  <CoinStatic amount={product.price} size="sm" />
                </div>

                <button
                  className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200"
                  disabled={!canAfford}
                  style={{
                    background: canAfford
                      ? "linear-gradient(135deg, var(--green-500), var(--green-600))"
                      : "var(--surface)",
                    color: canAfford ? "white" : "var(--text-muted)",
                    border: canAfford ? "none" : "1px solid var(--border)",
                    boxShadow: canAfford ? "0 2px 8px rgba(76,175,80,0.2)" : "none",
                    cursor: canAfford ? "pointer" : "default",
                    opacity: canAfford ? 1 : 0.7,
                  }}
                >
                  {canAfford
                    ? `Получить за ${product.price.toLocaleString("ru-RU")} коинов`
                    : `Ещё ${deficit.toLocaleString("ru-RU")} коинов`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
