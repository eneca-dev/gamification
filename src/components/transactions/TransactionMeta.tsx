import { getCategoryEmoji, getCategoryLabel } from '@/lib/gratitude-categories'

interface PluginUsageLineProps {
  plugins: Array<{ plugin_name: string }>
}

// Список использованных Revit-плагинов — только названия, без числа запусков:
// после перехода на plugins-usage-analytics день засчитывается за выполненное действие,
// и счётчик в launch_count пользователю как «число запусков» уже не объясняется.
// Показывается на всех транзакциях revit_using_plugins (виджет + страница операций).
export function PluginUsageLine({ plugins }: PluginUsageLineProps) {
  if (plugins.length === 0) return null
  return (
    <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--apex-text-muted)' }}>
      {plugins.map((p) => p.plugin_name).join('  ·  ')}
    </div>
  )
}

interface GratitudeMetaLineProps {
  isQuota: boolean
  categorySlug: string | null
}

// Категория благодарности (emoji + подпись) и тип отправки (подарок / квота).
export function GratitudeMetaLine({ isQuota, categorySlug }: GratitudeMetaLineProps) {
  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
        style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)' }}
      >
        <span className="text-[11px] leading-none">{getCategoryEmoji(categorySlug)}</span>
        {getCategoryLabel(categorySlug)}
      </span>
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
        style={
          isQuota
            ? { background: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)' }
            : { background: 'var(--apex-success-bg)', color: 'var(--apex-success-text)' }
        }
      >
        {isQuota ? 'квота' : 'подарок'}
      </span>
    </div>
  )
}
