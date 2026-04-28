'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { searchDevUsers } from './queries'

import type { DevUser } from './types'

const DEV_TOOLS_ENABLED =
  process.env.NODE_ENV === 'development' ||
  process.env.ENABLE_DEV_TOOLS === 'true'
const COOKIE_NAME = 'dev_impersonate'

export async function setImpersonation(email: string): Promise<{ success: boolean; error?: string }> {
  if (!DEV_TOOLS_ENABLED) return { success: false, error: 'Доступно только в dev-режиме' }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, email.toLowerCase(), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 часа
  })

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function clearImpersonation(): Promise<{ success: boolean }> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getImpersonationEmail(): Promise<string | null> {
  if (!DEV_TOOLS_ENABLED) return null

  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

export async function searchUsers(search: string): Promise<DevUser[]> {
  if (!DEV_TOOLS_ENABLED) return []
  return searchDevUsers(search)
}
