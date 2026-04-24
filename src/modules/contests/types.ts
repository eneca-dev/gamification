export type ContestType = 'revit_dept' | 'revit_team' | 'ws_dept' | 'ws_team'

export interface ContestWinner {
  contestMonth: string
  contestType: ContestType
  winner: string
  score: number
}

export const CONTEST_EVENT_KEYS: Record<ContestType, string> = {
  revit_dept: 'team_contest_top1_bonus',
  revit_team: 'revit_team_contest_top1_bonus',
  ws_dept:    'ws_dept_contest_top1_bonus',
  ws_team:    'ws_team_contest_top1_bonus',
}

export const CONTEST_LABELS: Record<ContestType, { title: string; icon: string; entity: 'department' | 'team' }> = {
  revit_dept: { title: 'Revit • Отдел',        icon: '⚡', entity: 'department' },
  revit_team: { title: 'Revit • Команда',       icon: '⚡', entity: 'team' },
  ws_dept:    { title: 'Worksection • Отдел',   icon: '📋', entity: 'department' },
  ws_team:    { title: 'Worksection • Команда', icon: '📋', entity: 'team' },
}
