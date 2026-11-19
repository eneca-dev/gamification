interface OrderTeamsMessage {
  productName: string
  buyerName: string | null
  buyerEmail: string | null
  coinsSpent: number
  userComment: string | null
}

export async function sendOrderToTeams(order: OrderTeamsMessage): Promise<void> {
  const webhookUrl = process.env.TEAMS_ORDERS_WEBHOOK_URL
  if (!webhookUrl) throw new Error('TEAMS_ORDERS_WEBHOOK_URL is not configured')

  const buyer = order.buyerName?.trim() || order.buyerEmail?.trim() || 'Неизвестный покупатель'
  const body = [
    { type: 'TextBlock', text: 'Новый заказ товара', weight: 'Bolder', wrap: true },
    { type: 'TextBlock', text: `Товар: ${order.productName}`, wrap: true },
    { type: 'TextBlock', text: `Покупатель: ${buyer}`, wrap: true },
    ...(order.buyerEmail ? [{ type: 'TextBlock', text: `Email: ${order.buyerEmail}`, wrap: true }] : []),
    { type: 'TextBlock', text: `Списано: ${order.coinsSpent.toLocaleString('ru-RU')} 💎`, wrap: true },
    ...(order.userComment ? [{ type: 'TextBlock', text: `Комментарий: ${order.userComment}`, wrap: true }] : []),
  ]

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.2',
          body,
        },
      }],
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) throw new Error(`Teams webhook returned HTTP ${response.status}`)
}
