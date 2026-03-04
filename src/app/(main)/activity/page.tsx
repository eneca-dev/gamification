"use client";

import { teamActivity } from "@/lib/data";

const typeColors: Record<string, { bg: string; border: string }> = {
  purchase: { bg: "var(--orange-50)", border: "rgba(var(--orange-500-rgb), 0.15)" },
  achievement: { bg: "var(--apex-success-bg)", border: "rgba(var(--apex-primary-rgb), 0.15)" },
  gratitude: { bg: "var(--tag-red-bg)", border: "rgba(var(--apex-danger-rgb), 0.1)" },
  earning: { bg: "var(--apex-success-bg)", border: "rgba(var(--apex-primary-rgb), 0.12)" },
  streak: { bg: "var(--apex-warning-bg)", border: "rgba(var(--orange-500-rgb), 0.12)" },
};

const typeLabels: Record<string, string> = {
  purchase: "Покупка",
  achievement: "Ачивка",
  gratitude: "Благодарность",
  earning: "Начисление",
  streak: "Серия",
};

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
          Лента команды
        </h1>
        <p className="text-sm font-medium mt-1" style={{ color: "var(--text-secondary)" }}>
          Что происходит у ваших коллег
        </p>
      </div>

      {/* Stats bar */}
      <div className="animate-fade-in-up stagger-1 grid grid-cols-4 gap-4">
        {[
          { label: "Активных сегодня", value: "12", icon: "👥" },
          { label: "Покупок за неделю", value: "8", icon: "🛍️" },
          { label: "Благодарностей", value: "15", icon: "💚" },
          { label: "Ачивок получено", value: "4", icon: "🏆" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4 card-hover"
            style={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "var(--apex-success-bg)" }}
              >
                {stat.icon}
              </div>
              <div>
                <div className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                  {stat.value}
                </div>
                <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity feed */}
      <div
        className="animate-fade-in-up stagger-2 rounded-2xl p-5"
        style={{
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="text-[12px] font-bold uppercase tracking-wider mb-5" style={{ color: "var(--text-muted)" }}>
          Последние события
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div
            className="absolute left-[22px] top-3 bottom-3 w-[2px]"
            style={{ background: "var(--border)" }}
          />

          <div className="space-y-1">
            {teamActivity.map((event, i) => {
              const colors = typeColors[event.type] || typeColors.earning;
              return (
                <div
                  key={event.id}
                  className="relative flex items-start gap-4 py-3 pl-1 rounded-xl transition-colors hover:bg-[rgba(var(--apex-primary-rgb),0.02)]"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  {/* Avatar on timeline */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                      style={{
                        background: event.avatarColor,
                      }}
                    >
                      {event.avatar}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                          {event.user}
                        </span>
                        <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                          {" "}{event.action}{" "}
                        </span>
                        <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                          {event.emoji} {event.target}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                        style={{
                          background: colors.bg,
                          border: `1px solid ${colors.border}`,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {typeLabels[event.type]}
                      </span>
                    </div>
                    <div className="text-[11px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
                      {event.time}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
