"use client";

import { AlertTriangle, Clock } from "lucide-react";
import type { WorksectionAlert } from "@/lib/data";

interface AlertsBannerProps {
  alerts: WorksectionAlert[];
}

export function AlertsBanner({ alerts }: AlertsBannerProps) {
  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: criticalCount > 0
          ? "linear-gradient(135deg, rgba(229,57,53,0.06) 0%, rgba(255,152,0,0.03) 100%)"
          : "linear-gradient(135deg, rgba(255,152,0,0.06) 0%, rgba(255,167,38,0.03) 100%)",
        border: criticalCount > 0
          ? "1px solid rgba(229,57,53,0.15)"
          : "1px solid rgba(255,152,0,0.15)",
      }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          size={16}
          style={{ color: criticalCount > 0 ? "#e53935" : "var(--orange-500)" }}
        />
        <span
          className="text-[12px] font-bold uppercase tracking-wider"
          style={{ color: criticalCount > 0 ? "#e53935" : "var(--orange-500)" }}
        >
          Внимание — {alerts.length} {alerts.length === 1 ? "задача требует" : "задачи требуют"} действий
        </span>
      </div>

      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 p-3 rounded-xl"
          style={{
            background: alert.severity === "critical"
              ? "rgba(229,57,53,0.05)"
              : "rgba(255,152,0,0.05)",
            border: alert.severity === "critical"
              ? "1px solid rgba(229,57,53,0.1)"
              : "1px solid rgba(255,152,0,0.1)",
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{
              background: alert.severity === "critical"
                ? "rgba(229,57,53,0.1)"
                : "rgba(255,152,0,0.1)",
            }}
          >
            <Clock
              size={16}
              style={{
                color: alert.severity === "critical" ? "#e53935" : "var(--orange-500)",
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-[13px] font-bold"
                style={{
                  color: alert.severity === "critical" ? "#e53935" : "#e65100",
                }}
              >
                {alert.title}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                style={{
                  background: alert.severity === "critical"
                    ? "rgba(229,57,53,0.12)"
                    : "rgba(255,152,0,0.12)",
                  color: alert.severity === "critical" ? "#e53935" : "var(--orange-500)",
                }}
              >
                {alert.penalty} б
              </span>
            </div>
            <div className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
              {alert.taskName}
            </div>
            <div className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
              {alert.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
