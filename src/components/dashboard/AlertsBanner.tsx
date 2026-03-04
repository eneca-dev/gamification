"use client";

import { AlertTriangle, Clock } from "lucide-react";
import type { WorksectionAlert } from "@/lib/data";

interface AlertsBannerProps {
  alerts: WorksectionAlert[];
}

export function AlertsBanner({ alerts }: AlertsBannerProps) {
  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const isCritical = criticalCount > 0;

  const bannerBg = isCritical ? "var(--apex-error-bg)" : "var(--apex-warning-bg)";
  const bannerBorder = isCritical
    ? `1px solid rgba(var(--apex-danger-rgb), 0.2)`
    : `1px solid rgba(var(--apex-warning-rgb), 0.2)`;
  const headerColor = isCritical ? "var(--apex-error-text)" : "var(--apex-warning-text)";

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: bannerBg, border: bannerBorder }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} style={{ color: headerColor }} />
        <span className="text-[12px] font-semibold" style={{ color: headerColor }}>
          Внимание — {alerts.length} {alerts.length === 1 ? "задача требует" : "задачи требуют"} действий
        </span>
      </div>

      {alerts.map((alert) => {
        const isAlertCritical = alert.severity === "critical";
        const itemBorder = isAlertCritical
          ? `1px solid rgba(var(--apex-danger-rgb), 0.15)`
          : `1px solid rgba(var(--apex-warning-rgb), 0.15)`;
        const iconBg = isAlertCritical ? "var(--apex-error-bg)" : "var(--apex-warning-bg)";
        const iconColor = isAlertCritical ? "var(--apex-error-text)" : "var(--apex-warning-text)";
        const titleColor = isAlertCritical ? "var(--apex-error-text)" : "var(--apex-warning-dark)";
        const badgeBg = isAlertCritical ? "var(--tag-red-bg)" : "var(--apex-warning-muted)";
        const badgeColor = isAlertCritical ? "var(--tag-red-text)" : "var(--apex-warning-text)";

        return (
          <div
            key={alert.id}
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{ background: "var(--apex-surface)", border: itemBorder }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: iconBg }}
            >
              <Clock size={15} style={{ color: iconColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold" style={{ color: titleColor }}>
                  {alert.title}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] font-semibold flex-shrink-0"
                  style={{ background: badgeBg, color: badgeColor }}
                >
                  {alert.penalty} б
                </span>
              </div>
              <div className="text-[12px] font-medium mt-0.5" style={{ color: "var(--apex-text)" }}>
                {alert.taskName}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--apex-text-muted)" }}>
                {alert.description}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
