import { getWorksectionTokens, refreshWorksectionToken } from '@/modules/auth'

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000 // 5 минут до истечения — рефрешим заранее

export async function worksectionApi(
  userId: string,
  path: string,
  options?: RequestInit
): Promise<Response> {
  const tokens = await getWorksectionTokens(userId)
  if (!tokens) throw new Error('No Worksection tokens found for user')

  const expiresAt = new Date(tokens.expires_at).getTime()
  const isExpiringSoon = expiresAt - REFRESH_THRESHOLD_MS < Date.now()

  const accessToken = isExpiringSoon
    ? await refreshWorksectionToken(userId)
    : tokens.access_token

  return fetch(`${tokens.account_url}/api/oauth2${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })
}
