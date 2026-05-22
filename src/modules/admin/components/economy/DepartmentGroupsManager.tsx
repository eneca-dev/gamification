'use client'

import { useState, useTransition } from 'react'

import { updateDepartmentGroup } from '@/modules/admin/index.client'
import type { DepartmentGroupRow } from '@/modules/admin'

interface DepartmentGroupsManagerProps {
  departments: string[]
  initialGroups: DepartmentGroupRow[]
}

type GroupType = 'designer' | 'non_designer'
type GroupMap = Map<string, GroupType>

function DeptChip({
  name,
  onDragStart,
  onMoveClick,
  targetGroup,
}: {
  name: string
  onDragStart: () => void
  onMoveClick: () => void
  targetGroup: GroupType
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing select-none group"
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-border)',
      }}
      title={`Перетащить в ${targetGroup === 'designer' ? 'проектировщики' : 'непроектировщики'}`}
    >
      <span className="text-[13px]" style={{ color: 'var(--apex-text)' }}>
        {name}
      </span>
      <button
        onClick={onMoveClick}
        className="text-[11px] px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: 'var(--apex-success-bg)',
          color: 'var(--apex-primary)',
          border: '1px solid var(--apex-primary)',
        }}
        title={`Переместить в ${targetGroup === 'designer' ? 'проектировщики' : 'непроектировщики'}`}
      >
        {targetGroup === 'designer' ? '→ проект.' : '→ не проект.'}
      </button>
    </div>
  )
}

function DropZone({
  group,
  label,
  departments,
  onDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
  onMoveChip,
  onChipDragStart,
  pendingDept,
}: {
  group: GroupType
  label: string
  departments: string[]
  onDrop: (e: React.DragEvent) => void
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onMoveChip: (dept: string) => void
  onChipDragStart: (dept: string) => void
  pendingDept: string | null
}) {
  const targetGroup: GroupType = group === 'designer' ? 'non_designer' : 'designer'

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          {label}
        </span>
        <span
          className="text-[11px] px-1.5 py-0.5 rounded-full tabular-nums"
          style={{ background: 'var(--apex-surface)', color: 'var(--apex-text-muted)', border: '1px solid var(--apex-border)' }}
        >
          {departments.length}
        </span>
      </div>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className="flex flex-col gap-1.5 min-h-[120px] rounded-2xl p-3 transition-colors"
        style={{
          background: isDragOver ? 'var(--apex-success-bg)' : 'var(--apex-surface-2, rgba(0,0,0,0.02))',
          border: `2px dashed ${isDragOver ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
        }}
      >
        {departments.length === 0 && (
          <div
            className="flex-1 flex items-center justify-center text-[12px]"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            Перетащите отдел сюда
          </div>
        )}
        {departments.map((dept) => (
          <div key={dept} className={pendingDept === dept ? 'opacity-50' : ''}>
            <DeptChip
              name={dept}
              onDragStart={() => onChipDragStart(dept)}
              onMoveClick={() => onMoveChip(dept)}
              targetGroup={targetGroup}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DepartmentGroupsManager({
  departments,
  initialGroups,
}: DepartmentGroupsManagerProps) {
  const [groupMap, setGroupMap] = useState<GroupMap>(() => {
    const m = new Map<string, GroupType>()
    for (const dept of departments) m.set(dept, 'non_designer')
    for (const g of initialGroups) m.set(g.department, g.group_type)
    return m
  })
  const [dragItem, setDragItem] = useState<string | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<GroupType | null>(null)
  const [pendingDept, setPendingDept] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const designers = departments.filter((d) => groupMap.get(d) === 'designer')
  const nonDesigners = departments.filter((d) => groupMap.get(d) !== 'designer')

  const moveDept = (dept: string, targetGroup: GroupType) => {
    const prevGroup = groupMap.get(dept) ?? 'non_designer'
    if (prevGroup === targetGroup) return

    setGroupMap((prev) => new Map([...prev, [dept, targetGroup]]))
    setPendingDept(dept)

    startTransition(async () => {
      const result = await updateDepartmentGroup(dept, targetGroup)
      setPendingDept(null)
      if (!result.success) {
        setGroupMap((prev) => new Map([...prev, [dept, prevGroup]]))
      }
    })
  }

  const handleDrop = (e: React.DragEvent, targetGroup: GroupType) => {
    e.preventDefault()
    setDragOverGroup(null)
    if (dragItem) {
      moveDept(dragItem, targetGroup)
      setDragItem(null)
    }
  }

  const handleDragOver = (e: React.DragEvent, group: GroupType) => {
    e.preventDefault()
    setDragOverGroup(group)
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Группировка отделов
        </h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--apex-text-muted)' }}>
          Перетащите отдел между группами — настройка применяется к фильтрации группы риска
        </p>
      </div>

      <div
        className={`rounded-2xl p-4 transition-opacity ${isPending ? 'opacity-80' : ''}`}
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <div className="flex gap-4">
          <DropZone
            group="designer"
            label="Проектировщики"
            departments={designers}
            onDrop={(e) => handleDrop(e, 'designer')}
            isDragOver={dragOverGroup === 'designer'}
            onDragOver={(e) => handleDragOver(e, 'designer')}
            onDragLeave={() => setDragOverGroup(null)}
            onMoveChip={(dept) => moveDept(dept, 'designer')}
            onChipDragStart={(dept) => setDragItem(dept)}
            pendingDept={pendingDept}
          />
          <div className="w-px self-stretch" style={{ background: 'var(--apex-border)' }} />
          <DropZone
            group="non_designer"
            label="Непроектировщики"
            departments={nonDesigners}
            onDrop={(e) => handleDrop(e, 'non_designer')}
            isDragOver={dragOverGroup === 'non_designer'}
            onDragOver={(e) => handleDragOver(e, 'non_designer')}
            onDragLeave={() => setDragOverGroup(null)}
            onMoveChip={(dept) => moveDept(dept, 'non_designer')}
            onChipDragStart={(dept) => setDragItem(dept)}
            pendingDept={pendingDept}
          />
        </div>
      </div>
    </section>
  )
}
