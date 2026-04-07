"use client";

import type { DailyTask } from "@/lib/data";
import { sourceColors } from "@/lib/data";
import { CheckCircle2 } from "lucide-react";
import { CoinIcon } from "@/components/CoinIcon";

interface DailyQuestsProps {
  tasks: DailyTask[];
}

export function DailyQuests({ tasks }: DailyQuestsProps) {
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalReward = tasks.reduce((s, t) => s + t.reward, 0);
  const allDone = completedCount === tasks.length;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--apex-surface)",
        border: "1px solid var(--apex-border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--apex-text-muted)" }}>
            Ежедневные задания
          </div>
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: "var(--orange-50)",
              color: "var(--tag-orange-text)",
              border: `1px solid rgba(var(--orange-500-rgb), 0.2)`,
            }}
          >
            <span className="inline-flex items-center gap-0.5">+{totalReward} <CoinIcon size={10} /></span>
          </span>
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
          style={{
            background: allDone ? "var(--apex-success-bg)" : "var(--apex-bg)",
            color: allDone ? "var(--apex-primary)" : "var(--apex-text-muted)",
            border: `1px solid ${allDone ? `rgba(var(--apex-primary-rgb), 0.2)` : "var(--apex-border)"}`,
          }}
        >
          {completedCount}/{tasks.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tasks.map((task) => {
          const srcColor = sourceColors[task.source];
          return (
            <div
              key={task.id}
              className="flex items-start gap-3 p-3.5 rounded-xl"
              style={{
                background: task.completed ? "var(--apex-success-bg)" : "var(--apex-bg)",
                border: task.completed
                  ? `1px solid rgba(var(--apex-primary-rgb), 0.15)`
                  : "1px solid var(--apex-border)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                style={{
                  background: task.completed ? "var(--apex-success-bg)" : "var(--apex-surface)",
                  border: "1px solid var(--apex-border)",
                }}
              >
                {task.completed
                  ? <CheckCircle2 size={18} style={{ color: "var(--apex-primary)" }} />
                  : task.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-semibold"
                    style={{ background: srcColor.bg, color: srcColor.text }}
                  >
                    {srcColor.label}
                  </span>
                </div>
                <div
                  className="text-[13px] font-semibold leading-snug"
                  style={{
                    color: task.completed ? "var(--apex-primary)" : "var(--apex-text)",
                    textDecoration: task.completed ? "line-through" : "none",
                    opacity: task.completed ? 0.8 : 1,
                  }}
                >
                  {task.title}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--apex-text-muted)" }}>
                  {task.description}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full w-16" style={{ background: "var(--apex-border)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(task.progress / task.total) * 100}%`,
                          background: task.completed ? "var(--apex-primary)" : "var(--orange-500)",
                        }}
                      />
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--apex-text-muted)" }}>
                      {task.progress}/{task.total}
                    </span>
                  </div>
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: task.completed ? "var(--apex-success-bg)" : "var(--orange-50)",
                      color: task.completed ? "var(--apex-primary)" : "var(--tag-orange-text)",
                    }}
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
