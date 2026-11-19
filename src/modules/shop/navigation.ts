export type StoreTab = 'catalog' | 'bimo' | 'roulette'

export function resolveStoreTab(tab: string | undefined, showBimo: boolean, hasUser: boolean): StoreTab {
  if (tab === 'bimo' && showBimo) return 'bimo'
  if (tab === 'roulette' && hasUser) return 'roulette'
  return 'catalog'
}
export function storeCategoryUrl(category: string): string {
  return category === 'all' ? '/store?tab=catalog' : '/store?tab=catalog&category=' + encodeURIComponent(category)
}
