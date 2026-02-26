"use client";

import type { DailyTask } from "@/lib/data";
import { sourceColors } from "@/lib/data";

interface DailyQuestsProps {
  tasks: DailyTask[];
}

export function DailyQuests({ tasks }: DailyQuestsProps) {
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalReward = tasks.reduce((s, t) => s + t.reward, 0);

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Ежедневные задания
          </div>
          <div
            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              background: "linear-gradient(135deg, var(--orange-500), var(--orange-400))",
              color: "white",
            }}
          >
            +{totalReward} баллов
          </div>
        </div>
        <div className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
          {completedCount}/{tasks.length} выполнено
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tasks.map((task) => {
          const srcColor = sourceColors[task.source];

          return (
            <div
              key={task.id}
              className="flex items-start gap-3 p-3.5 rounded-xl transition-all"
              style={{
                background: task.completed
                  ? "linear-gradient(135deg, var(--green-50), rgba(76,175,80,0.03))"
                  : "var(--surface)",
                border: task.completed
                  ? "1px solid var(--green-200)"
                  : "1px solid var(--border)",
                opacity: task.completed ? 0.75 : 1,
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                style={{
                  background: task.completed ? "var(--green-100)" : "var(--surface-elevated)",
                  border: task.completed ? "none" : "1px solid var(--border)",
                }}
              >
                {task.completed ? "✅" : task.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{
                      background: srcColor.bg,
                      color: srcColor.text,
                    }}
                  >
                    {srcColor.label}
                  </span>
                </div>
                <div
                  className="text-[13px] font-bold leading-snug"
                  style={{
                    color: task.completed ? "var(--green-700)" : "var(--text-primary)",
                    textDecoration: task.completed ? "line-through" : "none",
                  }}
                >
                  {task.title}
                </div>
                <div className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {task.description}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="flex-1 h-1.5 rounded-full w-16"
                      style={{ background: "var(--green-100)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(task.progress / task.total) * 100}%`,
                          background: task.completed ? "var(--green-500)" : "var(--orange-500)",
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                      {task.progress}/{task.total}
                    </span>
                  </div>
                  <span
                    className="text-[11px] font-extrabold"
                    style={{ color: task.completed ? "var(--green-600)" : "var(--orange-500)" }}
                  >
                    +{task.reward}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
