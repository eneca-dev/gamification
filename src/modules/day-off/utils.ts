export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  })
}
