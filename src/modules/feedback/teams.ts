import type { FeedbackInput } from './types'

interface FeedbackTeamsMessage {
  id: string
  type: 'bug' | 'suggestion'
  header: string
  description?: string
  expected_behavior?: string
  image_urls: string[]
  user_name: string | null
  user_email: string | null
}

interface AppealTeamsMessage {
  id: string
  dates: string[]
  tx_count: number
  tx_dates: string[]
  description: string
  task_url?: string
  image_urls: string[]
  total_coins: number
  user_name: string | null
  user_email: string | null
  user_department: string | null
  user_team: string | null
}

function textBlock(text: string, weight?: 'Bolder') {
  return {
    type: 'TextBlock',
    text,
    wrap: true,
    ...(weight ? { weight } : {}),
  }
}

function postToTeams(payload: Record<string, unknown>): Promise<Response> {
  const webhookUrl = process.env.TEAMS_FEEDBACK_WEBHOOK_URL
  if (!webhookUrl) throw new Error('TEAMS_FEEDBACK_WEBHOOK_URL is not configured')

  return fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  })
}

export async function sendFeedbackToTeams(
  feedback: Omit<FeedbackTeamsMessage, 'type'> & Extract<FeedbackInput, { type: 'bug' | 'suggestion' }>
): Promise<void> {
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

  const response = await postToTeams({
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
  })

  if (!response.ok) {
    throw new Error(`Teams webhook returned HTTP ${response.status}`)
  }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export async function sendAppealToTeams(appeal: AppealTeamsMessage): Promise<void> {
  const author = appeal.user_name?.trim() || appeal.user_email?.trim() || 'Неизвестный автор'
  const location = [appeal.user_department, appeal.user_team].filter(Boolean).join(' · ')

  const whatLines: string[] = []
  if (appeal.dates.length > 0) {
    whatLines.push(`Дни: ${appeal.dates.map(formatDate).join(', ')}`)
  }
  if (appeal.tx_count > 0) {
    const txDatesStr = appeal.tx_dates.length > 0
      ? ` (${[...new Set(appeal.tx_dates)].sort().map(formatDate).join(', ')})`
      : ''
    whatLines.push(`Операций: ${appeal.tx_count}${txDatesStr}`)
  }

  const body = [
    textBlock('Новое обжалование списания', 'Bolder'),
    textBlock(`Автор: ${author}`),
    ...(appeal.user_email ? [textBlock(`Email: ${appeal.user_email}`)] : []),
    ...(location ? [textBlock(`Отдел / команда: ${location}`)] : []),
    ...whatLines.map((line) => textBlock(line)),
    textBlock(`Сумма списания: ${appeal.total_coins.toLocaleString('ru-RU')} 💎`),
    textBlock(`Описание: ${appeal.description.slice(0, 4000)}`),
    ...(appeal.task_url ? [textBlock(`Задача: ${appeal.task_url}`)] : []),
  ]

  const actions: Array<Record<string, unknown>> = []
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    actions.push({
      type: 'Action.OpenUrl',
      title: 'Открыть в админке',
      url: `${appUrl.replace(/\/$/, '')}/admin/appeals`,
    })
  }
  for (const [index, url] of appeal.image_urls.slice(0, 4).entries()) {
    actions.push({
      type: 'Action.OpenUrl',
      title: `Скриншот ${index + 1}`,
      url,
    })
  }

  const response = await postToTeams({
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      contentUrl: null,
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.2',
        body,
        ...(actions.length > 0 ? { actions } : {}),
      },
    }],
  })

  if (!response.ok) {
    throw new Error(`Teams webhook returned HTTP ${response.status}`)
  }
}
