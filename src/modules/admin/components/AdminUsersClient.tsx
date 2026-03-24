'use client'

import type { AdminUserRow } from '../types'

import { UsersTable } from './UsersTable'

interface AdminUsersClientProps {
  users: AdminUserRow[]
}

export function AdminUsersClient({ users }: AdminUsersClientProps) {
  return <UsersTable users={users} />
}
