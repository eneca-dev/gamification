import { Info } from "lucide-react";

import { SyncTagBadge, SYNC_TAG_LABELS } from "./SyncTagBadge";

// Инфо-блок: какие проекты попадают в отслеживание и что будет при снятии метки.
export function TrackedProjectsInfo() {
  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{ background: "var(--apex-info-bg)", border: "1px solid var(--apex-border)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--apex-surface)", border: "1px solid var(--apex-border)" }}
        >
          <Info size={16} style={{ color: "var(--apex-info-text)" }} />
        </div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] leading-relaxed mb-2.5" style={{ color: "var(--apex-text-secondary)" }}>
            <span>
              В геймификации учитываются{" "}
              <span className="font-semibold" style={{ color: "var(--apex-text)" }}>
                только проекты
              </span>{" "}
              Worksection с{" "}
              <span className="font-semibold" style={{ color: "var(--apex-text)" }}>
                метками синхронизации
              </span>
              :
            </span>
            {SYNC_TAG_LABELS.map((label, index) => (
              <span key={label} className="flex items-center gap-2">
                {index > 0 && <span>или</span>}
                <SyncTagBadge label={label} />
              </span>
            ))}
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--apex-text-secondary)" }}>
            Если с проекта{" "}
            <span className="font-semibold" style={{ color: "var(--apex-text)" }}>
              снять метку
            </span>
            , все его задачи перестанут отслеживаться — они выпадут из геймификации и из мастера
            планирования: новые серии по ним не считаются, а незавершённые начисления сбрасываются.
          </p>
        </div>
      </div>
    </div>
  );
}
