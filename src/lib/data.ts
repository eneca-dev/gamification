import type { ReactNode } from 'react'

// ===== ТИПЫ ИСТОЧНИКОВ =====
export type EntitySource = "worksection" | "revit" | "social";

// ===== АЛЕРТЫ =====
export type AlertSeverity = "warning" | "critical";

export interface WorksectionAlert {
  id: number;
  severity: AlertSeverity;
  title: string;
  description: string;
  taskName: string;
  deadline: string;
  penalty: number;
}

// ===== ЕЖЕДНЕВНЫЕ ЗАДАНИЯ =====
export interface DailyTask {
  id: number;
  source: EntitySource;
  title: string;
  description: ReactNode;
  reward: number;
  icon: string;
  progress: number;
  total: number;
  completed: boolean;
}

// ===== ТРАНЗАКЦИИ =====
export type TransactionCategory =
  | "daily_green"
  | "streak_bonus"
  | "automation_run"
  | "gratitude_sent"
  | "gratitude_received"
  | "deadline_penalty"
  | "report_penalty"
  | "purchase";

export interface Transaction {
  id: number;
  source: EntitySource;
  category: TransactionCategory;
  description: string;
  amount: number;
  date: string;
  icon: string;
  plugins?: Array<{ plugin_name: string; launch_count: number }>;
}

// ===== СОРЕВНОВАНИЕ ОТДЕЛОВ =====
export interface DepartmentEntry {
  name: string;
  shortName: string;
  color: string;
  employeesUsing: number;
  totalEmployees: number;
  usagePercent: number;  // % автоматизаций (WS дисциплина)
  totalCoins: number;    // сумма 💎 за ревит (автоматизация)
  contestScore: number;  // totalCoins * (activeUsers / totalEmployees)
  wsPercent: number;     // % дисциплины Worksection
  isCurrentDepartment: boolean;
}

// ===== ЦВЕТОВАЯ МАРКИРОВКА ИСТОЧНИКОВ =====
export const sourceColors: Record<EntitySource, { bg: string; text: string; label: string }> = {
  worksection: {
    bg: "var(--tag-blue-bg)",
    text: "var(--tag-blue-text)",
    label: "WS",
  },
  revit: {
    bg: "var(--tag-orange-bg)",
    text: "var(--tag-orange-text)",
    label: "Revit",
  },
  social: {
    bg: "var(--tag-purple-bg)",
    text: "var(--tag-purple-text)",
    label: "Социальное",
  },
};
