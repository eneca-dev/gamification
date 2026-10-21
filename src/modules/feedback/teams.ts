import type { FeedbackInput } from './types'

interface FeedbackTeamsMessage extends FeedbackInput {
  id: string
  user_name: string | null
  user_email: string | null
}

function textBlock(text: string, weight?: 'Bolder') {
  return {
    type: 'TextBlock',
    text,
    wrap: true,
    ...(weight ? { weight } : {}),
  }
}

export async function sendFeedbackToTeams(feedback: FeedbackTeamsMessage): Promise<void> {
  const webhookUrl = process.env.TEAMS_FEEDBACK_WEBHOOK_URL
  if (!webhookUrl) throw new Error('TEAMS_FEEDBACK_WEBHOOK_URL is not configured')

  const kind = feedback.type === 'bug' ? 'Баг' : 'Предложение'
  const author = feedback.user_name?.trim() || feedback.user_email?.trim() || 'Неизвестный автор'
  const body = [
    textBlock(`Новая обратная связь: ${kind}`, 'Bolder'),
    textBlock(feedback.header),
    textBlock(`Автор: ${author}`),
    ...(feedback.user_email ? [textBlock(`Email: ${feedback.user_email}`)] : []),
    ...(feedback.description ? [textBlock(`Описание: ${feedback.description.slice(0, 4000)}`)] : []),
    ...(feedback.type === 'bug' && feedback.expected_behavior
      ? [textBlock(`Ожидаемое поведение: ${feedback.expected_behavior.slice(0, 2000)}`)]
      : []),
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
          ...(feedback.image_urls.length > 0
            ? {
                actions: feedback.image_urls.slice(0, 5).map((url, index) => ({
                  type: 'Action.OpenUrl',
                  title: `Скриншот ${index + 1}`,
                  url,
                })),
              }
            : {}),
        },
      }],
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`Teams webhook returned HTTP ${response.status}`)
  }
}
