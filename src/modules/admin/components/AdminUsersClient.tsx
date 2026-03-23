'use client'

import { useState } from 'react'

import type { AdminUserRow } from '../types'

import { UsersTable } from './UsersTable'
import { UserDetailModal } from './UserDetailModal'

interface AdminUsersClientProps {
  users: AdminUserRow[]
}

export function AdminUsersClient({ users }: AdminUsersClientProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  return (
    <>
      <UsersTable
        users={users}
        onSelectUser={(id) => setSelectedUserId(id)}
      />
      <UserDetailModal
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </>
  )
}
