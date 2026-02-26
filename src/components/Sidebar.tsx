"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { user } from "@/lib/data";

const navItems = [
  { href: "/", label: "Главная", icon: "🏠" },
  { href: "/store", label: "Магазин", icon: "🛍️" },
  { href: "/achievements", label: "Достижения", icon: "🏆" },
  { href: "/activity", label: "Лента команды", icon: "👥" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[260px] flex flex-col"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #f0faf0 100%)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo area */}
      <div className="px-6 pt-7 pb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm"
            style={{
              background: "linear-gradient(135deg, #4CAF50, #66bb6a)",
              boxShadow: "0 2px 8px rgba(76,175,80,0.3)",
            }}
          >
            ПК
          </div>
          <div>
            <div className="font-extrabold text-[15px]" style={{ color: "var(--text-primary)" }}>
              Проект-Коины
            </div>
            <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              Система мотивации
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-semibold transition-all duration-200"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, rgba(76,175,80,0.1), rgba(102,187,106,0.06))"
                    : "transparent",
                  color: isActive ? "var(--green-700)" : "var(--text-secondary)",
                  boxShadow: isActive ? "0 1px 4px rgba(76,175,80,0.08)" : "none",
                }}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
                {isActive && (
                  <div
                    className="ml-auto w-2 h-2 rounded-full"
                    style={{ background: "var(--green-500)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User profile at bottom */}
      <div className="px-4 pb-6">
        <div
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{
            background: "rgba(76,175,80,0.05)",
            border: "1px solid rgba(76,175,80,0.08)",
          }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{
              background: "linear-gradient(135deg, #4CAF50, #2e7d32)",
            }}
          >
            {user.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold truncate" style={{ color: "var(--text-primary)" }}>
              {user.fullName}
            </div>
            <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              {user.role}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
