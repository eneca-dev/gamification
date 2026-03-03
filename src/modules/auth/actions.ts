'use server'

import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from '@/config/supabase'

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
