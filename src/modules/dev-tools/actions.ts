'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { searchDevUsers } from './queries'

import type { DevUser } from './types'

const IS_DEV = process.env.NODE_ENV === 'development'
const COOKIE_NAME = 'dev_impersonate'

export async function setImpersonation(email: string): Promise<{ success: boolean; error?: string }> {
  if (!IS_DEV) return { success: false, error: 'Доступно только в dev-режиме' }

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
  if (!IS_DEV) return null

  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

export async function searchUsers(search: string): Promise<DevUser[]> {
  if (!IS_DEV) return []
  return searchDevUsers(search)
}
