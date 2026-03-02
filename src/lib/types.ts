export interface WorksectionTokenRow {
  user_id: string
  access_token: string
  refresh_token: string
  account_url: string
  expires_at: string // ISO 8601, приводить через new Date(expires_at)
  updated_at: string
}
