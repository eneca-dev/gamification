interface SyncTagBadgeProps {
  label: string;
}

// Цвета меток синхронизации: у каждой метки свой цвет из дизайн-системы (--tag-sync-*).
const SYNC_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "eneca.work sync": { bg: "var(--tag-sync-bg)", text: "var(--tag-sync-text)" },
  "eneca.work sync OS": { bg: "var(--tag-sync-os-bg)", text: "var(--tag-sync-os-text)" },
};

// Визуальная реплика метки синхронизации Worksection.
// Форма повторяет чип WS.
export function SyncTagBadge({ label }: SyncTagBadgeProps) {
  const colors = SYNC_TAG_COLORS[label] ?? { bg: "var(--tag-gray-bg)", text: "var(--tag-gray-text)" };

  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-px text-[12px] font-semibold whitespace-nowrap leading-tight"
      style={{
        background: colors.bg,
        color: colors.text,
        border: "1px solid var(--apex-border)",
      }}
    >
      {label}
    </span>
  );
}

// Метки, по которым проект попадает в геймификацию (совпадают с SYNC_TAG_IDS в VPS-скриптах).
export const SYNC_TAG_LABELS = ["eneca.work sync", "eneca.work sync OS"] as const;
