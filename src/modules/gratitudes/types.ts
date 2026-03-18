export interface GratitudeFeedItem {
  id: string
  sender_email: string
  sender_name: string
  recipient_email: string
  recipient_name: string
  message: string
  airtable_created_at: string
  week_start: string
  earned_coins: number  // 0 если не первая от отправителя за неделю, иначе реальная сумма из БД
}
