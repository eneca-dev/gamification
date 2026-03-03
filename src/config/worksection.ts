export const worksectionConfig = {
  clientId: process.env.WORKSECTION_CLIENT_ID!,
  clientSecret: process.env.WORKSECTION_CLIENT_SECRET!,
  redirectUri: process.env.WORKSECTION_REDIRECT_URI!,
  urls: {
    authorize: 'https://worksection.com/oauth2/authorize',
    token: 'https://worksection.com/oauth2/token',
    resource: 'https://worksection.com/oauth2/resource',
    refresh: 'https://worksection.com/oauth2/refresh',
  },
  scope: 'users_read',
} as const
