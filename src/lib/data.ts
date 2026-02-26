// ===== ТИПЫ ИСТОЧНИКОВ =====
export type EntitySource = "worksection" | "revit" | "social";

// ===== СТРИКИ =====
export interface StreakMilestone {
  days: number;
  reward: number;
  reached: boolean;
}

export interface RevitStreak {
  currentDays: number;
  milestones: StreakMilestone[];
}

export type WorksectionDayStatus = "green" | "red" | "gray" | "frozen" | "future" | "out";

export interface WorksectionDay {
  date: string;
  status: WorksectionDayStatus;
  automation?: boolean;
}

export interface WorksectionStreak {
  currentDays: number;
  calendarDays: WorksectionDay[];
  milestones: StreakMilestone[];
  automationCurrentDays: number;
  automationMilestones: StreakMilestone[];
}

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
  description: string;
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
}

// ===== СОРЕВНОВАНИЕ ОТДЕЛОВ =====
export interface DepartmentEntry {
  rank: number;
  name: string;
  shortName: string;
  color: string;
  employeesUsing: number;
  totalEmployees: number;
  usagePercent: number;
  isCurrentDepartment: boolean;
}

// ===== ЛИДЕРБОРД =====
export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  avatarColor: string;
  totalCoins: number;
  breakdown: {
    worksection: number;
    revit: number;
    social: number;
  };
  isCurrentUser: boolean;
}

// ===== ЦВЕТОВАЯ МАРКИРОВКА ИСТОЧНИКОВ =====
export const sourceColors: Record<EntitySource, { bg: string; text: string; label: string }> = {
  worksection: {
    bg: "rgba(33, 150, 243, 0.1)",
    text: "#1976d2",
    label: "WS",
  },
  revit: {
    bg: "var(--orange-50)",
    text: "var(--orange-500)",
    label: "Revit",
  },
  social: {
    bg: "rgba(156, 39, 176, 0.1)",
    text: "#7b1fa2",
    label: "Социальное",
  },
};

// ===================================================================
// МОКОВЫЕ ДАННЫЕ
// ===================================================================

export const user = {
  name: "Иван",
  fullName: "Иван Петров",
  avatar: "ИП",
  balance: 3450,
  weekStreak: 4,
  role: "Инженер-проектировщик",
};

export const worksectionStatus = {
  percent: 100,
  status: "perfect" as const,
  label: "Идеально!",
  description: "Серия: 28 зелёных дней подряд — тайм-трекинг и статусы ОК",
};

export const weeklyActivity = {
  revitAutomations: { used: 45, total: 50 },
  gratitudes: { sent: 1, total: 1 },
};

export const userGoal = {
  productName: "Мышка Logitech MX Master 3S",
  productEmoji: "🖱️",
  targetPrice: 6000,
  currentBalance: 3450,
};

// ===== АЛЕРТЫ WORKSECTION =====
export const wsAlerts: WorksectionAlert[] = [
  {
    id: 2,
    severity: "warning",
    title: "Статус не соответствует готовности",
    description: "Готовность задачи 100%, но статус не «Готово» — исправьте до конца дня",
    taskName: "Ревизия фасада — блок Б",
    deadline: "2026-02-26",
    penalty: -100,
  },
];

// ===== СТРИКИ =====
// Q1 2026: Jan 1 – Mar 31 (90 days), padded to full Mon–Sun weeks
// Week grid: Dec 29, 2025 (Mon) → Apr 5, 2026 (Sun) = 14 weeks × 7 = 98 cells
function generateQuarterDays(): WorksectionDay[] {
  const today = new Date("2026-02-26");
  const quarterStart = "2026-01-01";
  const quarterEnd = "2026-03-31";

  // Red penalty days
  const redDays = new Set(["2026-01-15", "2026-01-23", "2026-02-10"]);
  // Vacation (frozen streak) period
  const frozenStart = "2026-02-02";
  const frozenEnd = "2026-02-06";

  // Days automation was used (only past days, no frozen days)
  const automationDays = new Set([
    // January
    "2026-01-06", "2026-01-08", "2026-01-09",
    "2026-01-13", "2026-01-14",
    "2026-01-20", "2026-01-21",
    "2026-01-27", "2026-01-28", "2026-01-29",
    // February (no frozen period days)
    "2026-02-09", "2026-02-10", "2026-02-11",
    "2026-02-16", "2026-02-18", "2026-02-20",
    "2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26",
  ]);

  const days: WorksectionDay[] = [];
  // Jan 1, 2026 is Thursday → Monday of that week = Dec 29, 2025
  // Mar 31, 2026 is Tuesday → Sunday of that week = Apr 5, 2026
  const start = new Date("2025-12-29");
  const end = new Date("2026-04-05");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isOut = dateStr < quarterStart || dateStr > quarterEnd;
    const isFuture = d > today;

    let status: WorksectionDayStatus;
    if (isOut) {
      status = "out";
    } else if (isWeekend) {
      status = "gray";
    } else if (isFuture) {
      status = "future";
    } else if (redDays.has(dateStr)) {
      status = "red";
    } else if (dateStr >= frozenStart && dateStr <= frozenEnd) {
      status = "frozen";
    } else {
      status = "green";
    }

    days.push({
      date: dateStr,
      status,
      automation:
        !isOut && !isWeekend && !isFuture && status !== "frozen" && automationDays.has(dateStr),
    });
  }
  return days;
}

export const revitStreak: RevitStreak = {
  currentDays: 12,
  milestones: [
    { days: 7, reward: 10, reached: true },
    { days: 30, reward: 50, reached: false },
    { days: 90, reward: 500, reached: false },
  ],
};

export const worksectionStreak: WorksectionStreak = {
  currentDays: 11,
  calendarDays: generateQuarterDays(),
  milestones: [
    { days: 7, reward: 20, reached: true },
    { days: 30, reward: 100, reached: false },
    { days: 90, reward: 500, reached: false },
  ],
  automationCurrentDays: 8,
  automationMilestones: [
    { days: 5, reward: 15, reached: true },
    { days: 14, reward: 50, reached: false },
    { days: 30, reward: 200, reached: false },
  ],
};

// ===== ЕЖЕДНЕВНЫЕ ЗАДАНИЯ =====
// Два требования для зелёного дня (+3 ПК). Оба должны быть выполнены до 23:59.
export const dailyTasks: DailyTask[] = [
  {
    id: 1,
    source: "worksection",
    title: "Внесите тайм-трекинг за сегодня",
    description: "Норма при ставке 1.0: от 6 до 10 часов. Срок — до 23:59",
    reward: 1,
    icon: "⏱️",
    progress: 6,
    total: 8,
    completed: false,
  },
  {
    id: 3,
    source: "worksection",
    title: "Обновите динамику задач",
    description: "Задачи уровня 3 — прогресс раз в 7 дней, разделы — раз в 14 дней",
    reward: 2,
    icon: "📈",
    progress: 0,
    total: 1,
    completed: false,
  },
];

// ===== ТРАНЗАКЦИИ (единая лента) =====
export const recentTransactions: Transaction[] = [
  {
    id: 1,
    source: "worksection",
    category: "daily_green",
    description: "Зелёный день — тайм-трекинг и статусы ОК",
    amount: 3,
    date: "Сегодня",
    icon: "🟢",
  },
  {
    id: 2,
    source: "social",
    category: "gratitude_received",
    description: "Благодарность от А. Петрова",
    amount: 10,
    date: "Сегодня",
    icon: "🤝",
  },
  {
    id: 3,
    source: "worksection",
    category: "daily_green",
    description: "Зелёный день — тайм-трекинг и статусы ОК",
    amount: 3,
    date: "Вчера",
    icon: "🟢",
  },
  {
    id: 4,
    source: "worksection",
    category: "streak_bonus",
    description: "Бонус: серия 7 зелёных дней",
    amount: 20,
    date: "Вчера",
    icon: "🔥",
  },
  {
    id: 5,
    source: "worksection",
    category: "report_penalty",
    description: "Красный день: тайм-трекинг не внесён, стрик сброшен",
    amount: -100,
    date: "10 февр.",
    icon: "🔴",
  },
  {
    id: 6,
    source: "worksection",
    category: "streak_bonus",
    description: "Бонус: серия 30 зелёных дней",
    amount: 100,
    date: "28 янв.",
    icon: "🏅",
  },
];

// ===== ЛИДЕРБОРД =====
export const leaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    name: "Сергей Иванов",
    avatar: "СИ",
    avatarColor: "#607d8b",
    totalCoins: 890,
    breakdown: { worksection: 450, revit: 320, social: 120 },
    isCurrentUser: false,
  },
  {
    rank: 2,
    name: "Иван Петров",
    avatar: "ИП",
    avatarColor: "#4caf50",
    totalCoins: 820,
    breakdown: { worksection: 400, revit: 300, social: 120 },
    isCurrentUser: true,
  },
  {
    rank: 3,
    name: "Мария Сидорова",
    avatar: "МС",
    avatarColor: "#e91e63",
    totalCoins: 750,
    breakdown: { worksection: 380, revit: 250, social: 120 },
    isCurrentUser: false,
  },
  {
    rank: 4,
    name: "Алексей Козлов",
    avatar: "АК",
    avatarColor: "#2196f3",
    totalCoins: 680,
    breakdown: { worksection: 350, revit: 200, social: 130 },
    isCurrentUser: false,
  },
  {
    rank: 5,
    name: "Ольга Новикова",
    avatar: "ОН",
    avatarColor: "#9c27b0",
    totalCoins: 610,
    breakdown: { worksection: 300, revit: 180, social: 130 },
    isCurrentUser: false,
  },
];

// ===== СОРЕВНОВАНИЕ ОТДЕЛОВ =====
export const departmentContest: DepartmentEntry[] = [
  {
    rank: 1,
    name: "Архитектурный отдел",
    shortName: "АО",
    color: "#e91e63",
    employeesUsing: 11,
    totalEmployees: 12,
    usagePercent: 92,
    isCurrentDepartment: false,
  },
  {
    rank: 2,
    name: "Конструктивный отдел",
    shortName: "КО",
    color: "#2196f3",
    employeesUsing: 7,
    totalEmployees: 9,
    usagePercent: 78,
    isCurrentDepartment: true,
  },
  {
    rank: 3,
    name: "Инженерный отдел (ОВиК)",
    shortName: "ОВиК",
    color: "#ff9800",
    employeesUsing: 5,
    totalEmployees: 8,
    usagePercent: 63,
    isCurrentDepartment: false,
  },
  {
    rank: 4,
    name: "Электротехнический отдел",
    shortName: "ЭО",
    color: "#9c27b0",
    employeesUsing: 4,
    totalEmployees: 7,
    usagePercent: 57,
    isCurrentDepartment: false,
  },
  {
    rank: 5,
    name: "BIM-отдел",
    shortName: "BIM",
    color: "#00bcd4",
    employeesUsing: 3,
    totalEmployees: 6,
    usagePercent: 50,
    isCurrentDepartment: false,
  },
];

// Дней до конца месяца
export const daysUntilMonthEnd = 2;

// ===== СТАРЫЕ ДАННЫЕ (для других страниц) =====
export const transactions = [
  {
    id: 1,
    description: "Зеленая неделя Worksection",
    amount: 50,
    type: "income" as const,
    date: "Сегодня",
    icon: "🟢",
  },
  {
    id: 2,
    description: "Благодарность от А. Петрова",
    amount: 50,
    type: "income" as const,
    date: "Сегодня",
    icon: "🤝",
  },
  {
    id: 3,
    description: "Автоматизация Revit — модель этажа",
    amount: 120,
    type: "income" as const,
    date: "Вчера",
    icon: "⚡",
  },
  {
    id: 4,
    description: "Пицца на отдел",
    amount: -1200,
    type: "expense" as const,
    date: "22 февр.",
    icon: "🍕",
  },
  {
    id: 5,
    description: "Зеленая неделя Worksection",
    amount: 50,
    type: "income" as const,
    date: "20 февр.",
    icon: "🟢",
  },
];

export const storeProducts = [
  { id: 0, name: "Вторая жизнь — аннуляция нарушения и сохранение стрика", emoji: "🛡️", price: 500, category: "fun", tag: "Защита стрика" },
  { id: 1, name: "Именная табличка на дверь/стол", emoji: "🏷️", price: 500, category: "fun", tag: "Доступно" },
  { id: 2, name: "Переходящий кубок / тотем на стол", emoji: "🏆", price: 800, category: "fun", tag: "Фан" },
  { id: 3, name: "VIP-парковка на 1 месяц", emoji: "🅿️", price: 2000, category: "fun", tag: "Привилегия" },
  { id: 4, name: "Начальник на подхвате (15 мин)", emoji: "🫡", price: 2500, category: "fun", tag: "Эксклюзив" },
  { id: 5, name: "Кофе от Григория", emoji: "☕", price: 3000, category: "fun", tag: "Эксклюзив" },
  { id: 6, name: "Доставка кофе из кофейни", emoji: "🥤", price: 250, category: "food", tag: "Доступно" },
  { id: 7, name: "Завтрак на столе (круассан и сок)", emoji: "🥐", price: 300, category: "food", tag: "Доступно" },
  { id: 8, name: "Оплата такси (разовая поездка)", emoji: "🚕", price: 400, category: "food", tag: "Транспорт" },
  { id: 9, name: "Доставка бизнес-ланча", emoji: "🍱", price: 400, category: "food", tag: "Популярное" },
  { id: 10, name: "Пицца на отдел", emoji: "🍕", price: 1200, category: "food", tag: "Популярное" },
  { id: 11, name: "Суши-сет на команду", emoji: "🍣", price: 1800, category: "food", tag: "Для команды" },
  { id: 12, name: "Сертификат (Ozon / Золотое Яблоко / Steam, 50 BYN)", emoji: "🎫", price: 500, category: "merch", tag: "Доступно" },
  { id: 13, name: "Подписка (Telegram Premium / Яндекс.Плюс / ChatGPT Plus, 3 мес.)", emoji: "⭐", price: 750, category: "merch", tag: "Подписка" },
  { id: 14, name: "Премиальная термокружка (Yeti/Kambukka)", emoji: "🍵", price: 2200, category: "merch", tag: "Мерч" },
  { id: 15, name: "Фирменное худи", emoji: "👕", price: 2500, category: "merch", tag: "Мерч" },
  { id: 16, name: "Городской рюкзак (Thule/XD Design)", emoji: "🎒", price: 6000, category: "merch", tag: "Премиум" },
  { id: 17, name: "Оплата профильного обучения/курса", emoji: "🎓", price: 5000, category: "merch", tag: "Развитие" },
  { id: 18, name: "Большой премиальный коврик на стол", emoji: "🖥️", price: 1500, category: "upgrade", tag: "Апгрейд" },
  { id: 19, name: "Лампа на монитор (скринбар)", emoji: "💡", price: 2500, category: "upgrade", tag: "Апгрейд" },
  { id: 20, name: "Эргономичная подставка для ног", emoji: "🦶", price: 3000, category: "upgrade", tag: "Апгрейд" },
  { id: 21, name: "Вертикальная мышь (эргономичная)", emoji: "🖱️", price: 4000, category: "upgrade", tag: "Апгрейд" },
  { id: 22, name: "Мышь Logitech MX Master 3S", emoji: "🖲️", price: 6000, category: "upgrade", tag: "Апгрейд" },
  { id: 23, name: "Механическая клавиатура (Keychron/Logitech)", emoji: "⌨️", price: 6500, category: "upgrade", tag: "Апгрейд" },
  { id: 24, name: "Ортопедическое или геймерское кресло", emoji: "🪑", price: 15000, category: "upgrade", tag: "Премиум" },
  { id: 25, name: "Настольная игра для команды", emoji: "🎲", price: 1800, category: "fun", tag: "Для команды" },
];

export const filterTabs = [
  { id: "all", label: "Все" },
  { id: "fun", label: "Привилегии" },
  { id: "food", label: "Еда и транспорт" },
  { id: "merch", label: "Сертификаты и мерч" },
  { id: "upgrade", label: "Апгрейд рабочего места" },
];

export const balanceHistory = [
  { month: "Сент", value: 800 },
  { month: "Окт", value: 1350 },
  { month: "Нояб", value: 1900 },
  { month: "Дек", value: 2400 },
  { month: "Янв", value: 2850 },
  { month: "Февр", value: 3450 },
];

export const incomeSourcesData = [
  { name: "Worksection и автоматизации", value: 60, color: "#4CAF50" },
  { name: "Автоматизация Revit", value: 25, color: "#66bb6a" },
  { name: "Благодарности", value: 15, color: "#a5d6a7" },
];

export const achievements = [
  { id: 1, name: "Первый коин", icon: "🌱", earned: true, date: "15 сент. 2025", description: "Заработайте первый Проект-коин" },
  { id: 2, name: "Неделя порядка", icon: "📋", earned: true, date: "22 сент. 2025", description: "Держите Worksection зеленым 1 неделю" },
  { id: 3, name: "Месяц дисциплины", icon: "🏅", earned: true, date: "15 окт. 2025", description: "Держите Worksection зеленым 1 месяц" },
  { id: 4, name: "Автоматизатор", icon: "⚡", earned: true, date: "3 нояб. 2025", description: "Используйте 50 автоматизаций Revit" },
  { id: 5, name: "Щедрая душа", icon: "💚", earned: true, date: "10 дек. 2025", description: "Отправьте 10 благодарностей" },
  { id: 6, name: "Квартал стабильности", icon: "🏆", earned: false, date: null, description: "Держите Worksection зеленым 3 месяца подряд" },
  { id: 7, name: "Тысячник", icon: "💰", earned: true, date: "28 окт. 2025", description: "Накопите 1 000 Проект-коинов" },
  { id: 8, name: "Первая покупка", icon: "🛒", earned: true, date: "5 нояб. 2025", description: "Совершите первую покупку в магазине" },
  { id: 9, name: "Магнат", icon: "👑", earned: false, date: null, description: "Накопите 10 000 Проект-коинов" },
  { id: 10, name: "Полная автоматизация", icon: "🤖", earned: false, date: null, description: "Используйте все автоматизации Revit за неделю" },
  { id: 11, name: "Команда мечты", icon: "🌟", earned: false, date: null, description: "Получите благодарность от 5 разных коллег" },
  { id: 12, name: "Марафонец", icon: "🎯", earned: false, date: null, description: "Держите Worksection зеленым 6 месяцев подряд" },
];

export const dailyQuests = [
  { id: 1, title: "Внесите тайм-трекинг за сегодня", description: "Норма при ставке 1.0: от 6 до 10 часов. Срок — до 23:59", reward: 1, icon: "⏱️", progress: 6, total: 8, completed: false },
  { id: 2, title: "Проверьте статусы задач", description: "Статус «Готово» — только при 100%, часы не вносятся в завершённые", reward: 1, icon: "📋", progress: 1, total: 1, completed: true },
  { id: 3, title: "Обновите динамику задач", description: "Задачи уровня 3 — прогресс раз в 7 дней, разделы — раз в 14 дней", reward: 1, icon: "📈", progress: 0, total: 1, completed: false },
];

export const teamActivity = [
  { id: 1, user: "Мария Сидорова", avatar: "МС", avatarColor: "#e91e63", action: "купила", target: "Пицца на отдел", emoji: "🍕", time: "5 минут назад", type: "purchase" as const },
  { id: 2, user: "Алексей Козлов", avatar: "АК", avatarColor: "#2196f3", action: "получил ачивку", target: "Месяц дисциплины", emoji: "🏅", time: "32 минуты назад", type: "achievement" as const },
  { id: 3, user: "Ольга Новикова", avatar: "ОН", avatarColor: "#9c27b0", action: "отправила благодарность", target: "Ивану Петрову", emoji: "💚", time: "1 час назад", type: "gratitude" as const },
  { id: 4, user: "Дмитрий Волков", avatar: "ДВ", avatarColor: "#ff9800", action: "заработал", target: "+20 за 7 зелёных дней подряд", emoji: "🔥", time: "1 час назад", type: "earning" as const },
  { id: 5, user: "Анна Петрова", avatar: "АП", avatarColor: "#4caf50", action: "купила", target: "Сертификат Ozon", emoji: "🎫", time: "2 часа назад", type: "purchase" as const },
  { id: 6, user: "Сергей Иванов", avatar: "СИ", avatarColor: "#607d8b", action: "достиг серии", target: "56 зелёных дней подряд", emoji: "🔥", time: "3 часа назад", type: "streak" as const },
  { id: 7, user: "Елена Морозова", avatar: "ЕМ", avatarColor: "#00bcd4", action: "получила ачивку", target: "Щедрая душа", emoji: "💚", time: "3 часа назад", type: "achievement" as const },
  { id: 8, user: "Михаил Кузнецов", avatar: "МК", avatarColor: "#795548", action: "купил", target: "Кофе от Григория", emoji: "☕", time: "5 часов назад", type: "purchase" as const },
  { id: 9, user: "Наталья Белова", avatar: "НБ", avatarColor: "#f44336", action: "отправила благодарность", target: "Сергею Иванову", emoji: "🤝", time: "5 часов назад", type: "gratitude" as const },
  { id: 10, user: "Артём Соколов", avatar: "АС", avatarColor: "#3f51b5", action: "купил", target: "Суши-сет на команду", emoji: "🍣", time: "Вчера", type: "purchase" as const },
  { id: 11, user: "Мария Сидорова", avatar: "МС", avatarColor: "#e91e63", action: "заработала", target: "+20 за 7 зелёных дней подряд", emoji: "🟢", time: "Вчера", type: "earning" as const },
  { id: 12, user: "Дмитрий Волков", avatar: "ДВ", avatarColor: "#ff9800", action: "получил ачивку", target: "Тысячник", emoji: "💰", time: "Вчера", type: "achievement" as const },
];

export const operationsHistory = [
  { date: "25.02.2026", operation: "Зелёный день Worksection", amount: 3 },
  { date: "25.02.2026", operation: "Недельный бонус (7 зелёных дней)", amount: 20 },
  { date: "25.02.2026", operation: "Благодарность от А. Петрова", amount: 10 },
  { date: "24.02.2026", operation: "Зелёный день Worksection", amount: 3 },
  { date: "22.02.2026", operation: "Покупка: Пицца на отдел", amount: -1200 },
  { date: "20.02.2026", operation: "Зелёный день Worksection", amount: 3 },
  { date: "15.02.2026", operation: "Благодарность от М. Сидоровой", amount: 10 },
  { date: "10.02.2026", operation: "Красный день: тайм-трекинг не внесён", amount: -100 },
  { date: "05.02.2026", operation: "Покупка: Сертификат Ozon", amount: -500 },
  { date: "28.01.2026", operation: "Месячный бонус (30 зелёных дней)", amount: 100 },
];
