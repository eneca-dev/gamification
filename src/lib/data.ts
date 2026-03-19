// ===== ТИПЫ ИСТОЧНИКОВ =====
export type EntitySource = "worksection" | "revit" | "social";

// ===== АДМИН-ПАНЕЛЬ =====
export type AdminEventType = "earning" | "penalty" | "purchase" | "achievement" | "streak";
export type WsStatus = "green" | "red" | "inactive";

export interface AdminEmployee {
  id: number;
  name: string;
  avatar: string;
  avatarColor: string;
  department: string;
  role: string;
  balance: number;
  earnedThisMonth: number;
  penaltiesThisMonth: number;
  wsStatus: WsStatus;
  lastActive: string;
}

export interface AdminEvent {
  id: number;
  timestamp: string;
  employee: string;
  avatar: string;
  avatarColor: string;
  department: string;
  type: AdminEventType;
  description: string;
  amount: number;
}

// ===== СТРИКИ (типы перенесены в @/modules/streak-panel/types.ts) =====

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
  name: string;
  shortName: string;
  color: string;
  employeesUsing: number;
  totalEmployees: number;
  usagePercent: number;  // % автоматизаций
  wsPercent: number;     // % дисциплины Worksection
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

// Моковые данные стриков удалены — реальные данные из @/modules/streak-panel

// ===== ЕЖЕДНЕВНЫЕ ЗАДАНИЯ =====
// WS-задания будут подключены из реальных данных позже
export const dailyTasks: DailyTask[] = [];

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
    name: "Архитектурные решения",
    shortName: "АР",
    color: "#e91e63",
    employeesUsing: 10,
    totalEmployees: 11,
    usagePercent: 91,
    wsPercent: 85,
    isCurrentDepartment: false,
  },
  {
    name: "Водоснабжение и канализация",
    shortName: "ВК",
    color: "#2196f3",
    employeesUsing: 6,
    totalEmployees: 8,
    usagePercent: 75,
    wsPercent: 94,
    isCurrentDepartment: false,
  },
  {
    name: "Отопление и вентиляция",
    shortName: "ОВ",
    color: "#ff9800",
    employeesUsing: 5,
    totalEmployees: 8,
    usagePercent: 63,
    wsPercent: 72,
    isCurrentDepartment: false,
  },
  {
    name: "Конструктивный раздел (гражд.)",
    shortName: "КР гражд",
    color: "#4caf50",
    employeesUsing: 7,
    totalEmployees: 9,
    usagePercent: 78,
    wsPercent: 88,
    isCurrentDepartment: true,
  },
  {
    name: "Технологические решения",
    shortName: "ТХ",
    color: "#9c27b0",
    employeesUsing: 4,
    totalEmployees: 7,
    usagePercent: 57,
    wsPercent: 61,
    isCurrentDepartment: false,
  },
  {
    name: "Тепломеханика",
    shortName: "ТМ",
    color: "#00bcd4",
    employeesUsing: 3,
    totalEmployees: 6,
    usagePercent: 50,
    wsPercent: 55,
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
  { name: "Worksection и автоматизации", value: 60, color: "#1B6B58" },
  { name: "Автоматизация Revit", value: 25, color: "#F97316" },
  { name: "Благодарности", value: 15, color: "#9DD4CB" },
];

export const achievements = [
  // === Worksection: Дисциплина ведения задач ===
  {
    id: 1,
    name: "Эталонная дисциплина",
    icon: "🏆",
    earned: false,
    date: null,
    description: "Ни одного «красного» дня в течение всего года. Приз: органайзер из архит. бетона + 1000 коинов",
  },
  {
    id: 2,
    name: "Эффективное управление",
    icon: "👑",
    earned: false,
    date: null,
    description: "Команда с наименьшим % «красных» дней за квартал. Бонус тимлиду: 1500 коинов + Parker",
  },
  {
    id: 3,
    name: "Образцовый отдел",
    icon: "🎖️",
    earned: false,
    date: null,
    description: "Отдел с наименьшим % «красных» дней за квартал среди всех отделов. Бонус НО: 2000 коинов",
  },
  // === Revit: Техническая эффективность ===
  {
    id: 4,
    name: "Лидер автоматизации",
    icon: "⚡",
    earned: false,
    date: null,
    description: "Абсолютный Топ-1 по запускам плагинов за квартал согласно логам. Бонус: 2000 коинов",
  },
  {
    id: 5,
    name: "Технологичная команда",
    icon: "🤖",
    earned: false,
    date: null,
    description: "Топ-1 команда по среднему числу запусков плагинов на сотрудника за квартал. Бонус: +500 коинов каждому",
  },
  {
    id: 6,
    name: "Цифровой авангард",
    icon: "🚀",
    earned: false,
    date: null,
    description: "Топ-1 отдел по вовлечённости в автоматизации за квартал. Бонус: пицца на весь отдел",
  },
  // === Корпоративная культура: Благодарности Airtable ===
  {
    id: 7,
    name: "Поддержка коллег",
    icon: "🤝",
    earned: true,
    date: "Q4 2025",
    description: "Топ-1 по количеству полученных благодарностей за квартал. Приз: стеклянная стела + 1000 коинов",
  },
  {
    id: 8,
    name: "Межфункциональное взаимодействие",
    icon: "🌐",
    earned: true,
    date: "Q4 2025",
    description: "Благодарности от сотрудников из 3+ разных отделов за один квартал. Бонус: 600 коинов",
  },
  {
    id: 9,
    name: "Наставничество",
    icon: "📚",
    earned: false,
    date: null,
    description: "5+ благодарностей в категории «Обучение/Менторство» за квартал. Приз: кожаный ежедневник + 1200 коинов",
  },
];

export const dailyQuests = [
  { id: 1, title: "Внесите тайм-трекинг за сегодня", description: "Норма при ставке 1.0: от 6 до 10 часов. Срок — до 23:59", reward: 1, icon: "⏱️", progress: 6, total: 8, completed: false },
  { id: 2, title: "Проверьте статусы задач", description: "Статус «Готово» — только при 100%, часы не вносятся в завершённые", reward: 1, icon: "📋", progress: 1, total: 1, completed: true },
  { id: 3, title: "Обновите динамику задач", description: "Задачи уровня 3 — прогресс раз в 7 дней, разделы — раз в 14 дней", reward: 1, icon: "📈", progress: 0, total: 1, completed: false },
];

export const teamActivity = [
  { id: 1, user: "Мария Сидорова", avatar: "МС", avatarColor: "#e91e63", action: "купила", target: "Пицца на отдел", emoji: "🍕", time: "5 минут назад", type: "purchase" as const },
  { id: 2, user: "Алексей Козлов", avatar: "АК", avatarColor: "#2196f3", action: "получил ачивку", target: "Межфункциональное взаимодействие", emoji: "🌐", time: "32 минуты назад", type: "achievement" as const },
  { id: 3, user: "Ольга Новикова", avatar: "ОН", avatarColor: "#9c27b0", action: "отправила благодарность", target: "Ивану Петрову", emoji: "💚", time: "1 час назад", type: "gratitude" as const },
  { id: 4, user: "Дмитрий Волков", avatar: "ДВ", avatarColor: "#ff9800", action: "заработал", target: "+20 за 7 зелёных дней подряд", emoji: "🔥", time: "1 час назад", type: "earning" as const },
  { id: 5, user: "Анна Петрова", avatar: "АП", avatarColor: "#4caf50", action: "купила", target: "Сертификат Ozon", emoji: "🎫", time: "2 часа назад", type: "purchase" as const },
  { id: 6, user: "Сергей Иванов", avatar: "СИ", avatarColor: "#607d8b", action: "достиг серии", target: "56 зелёных дней подряд", emoji: "🔥", time: "3 часа назад", type: "streak" as const },
  { id: 7, user: "Елена Морозова", avatar: "ЕМ", avatarColor: "#00bcd4", action: "получила ачивку", target: "Поддержка коллег", emoji: "🤝", time: "3 часа назад", type: "achievement" as const },
  { id: 8, user: "Михаил Кузнецов", avatar: "МК", avatarColor: "#795548", action: "купил", target: "Кофе от Григория", emoji: "☕", time: "5 часов назад", type: "purchase" as const },
  { id: 9, user: "Наталья Белова", avatar: "НБ", avatarColor: "#f44336", action: "отправила благодарность", target: "Сергею Иванову", emoji: "🤝", time: "5 часов назад", type: "gratitude" as const },
  { id: 10, user: "Артём Соколов", avatar: "АС", avatarColor: "#3f51b5", action: "купил", target: "Суши-сет на команду", emoji: "🍣", time: "Вчера", type: "purchase" as const },
  { id: 11, user: "Мария Сидорова", avatar: "МС", avatarColor: "#e91e63", action: "заработала", target: "+20 за 7 зелёных дней подряд", emoji: "🟢", time: "Вчера", type: "earning" as const },
  { id: 12, user: "Дмитрий Волков", avatar: "ДВ", avatarColor: "#ff9800", action: "получил ачивку", target: "Лидер автоматизации", emoji: "⚡", time: "Вчера", type: "achievement" as const },
];

// ===== АДМИН: СОТРУДНИКИ =====
export const adminEmployees: AdminEmployee[] = [
  { id: 1,  name: "Сергей Иванов",    avatar: "СИ", avatarColor: "#607d8b", department: "АР",       role: "Главный архитектор",      balance: 4210, earnedThisMonth: 320, penaltiesThisMonth: 0,    wsStatus: "green",    lastActive: "Сегодня" },
  { id: 2,  name: "Иван Петров",      avatar: "ИП", avatarColor: "#4caf50", department: "КР гражд", role: "Инженер-проектировщик",   balance: 3450, earnedThisMonth: 280, penaltiesThisMonth: 100,  wsStatus: "green",    lastActive: "Сегодня" },
  { id: 3,  name: "Мария Сидорова",   avatar: "МС", avatarColor: "#e91e63", department: "АР",       role: "Архитектор",              balance: 3180, earnedThisMonth: 310, penaltiesThisMonth: 0,    wsStatus: "green",    lastActive: "Сегодня" },
  { id: 4,  name: "Алексей Козлов",   avatar: "АК", avatarColor: "#2196f3", department: "ВК",       role: "Инженер ВК",              balance: 2890, earnedThisMonth: 240, penaltiesThisMonth: 0,    wsStatus: "green",    lastActive: "Вчера"   },
  { id: 5,  name: "Ольга Новикова",   avatar: "ОН", avatarColor: "#9c27b0", department: "ОВ",       role: "Инженер ОВ",              balance: 2640, earnedThisMonth: 195, penaltiesThisMonth: 100,  wsStatus: "red",      lastActive: "Сегодня" },
  { id: 6,  name: "Дмитрий Волков",   avatar: "ДВ", avatarColor: "#ff9800", department: "КР гражд", role: "Инженер-конструктор",     balance: 2410, earnedThisMonth: 210, penaltiesThisMonth: 0,    wsStatus: "green",    lastActive: "Сегодня" },
  { id: 7,  name: "Анна Петрова",     avatar: "АП", avatarColor: "#00bcd4", department: "АР",       role: "Архитектор",              balance: 2250, earnedThisMonth: 175, penaltiesThisMonth: 200,  wsStatus: "red",      lastActive: "26.02"   },
  { id: 8,  name: "Елена Морозова",   avatar: "ЕМ", avatarColor: "#00bcd4", department: "ТХ",       role: "Технолог",                balance: 1980, earnedThisMonth: 160, penaltiesThisMonth: 0,    wsStatus: "green",    lastActive: "Вчера"   },
  { id: 9,  name: "Михаил Кузнецов",  avatar: "МК", avatarColor: "#795548", department: "ТМ",       role: "Инженер ТМ",              balance: 1740, earnedThisMonth: 130, penaltiesThisMonth: 100,  wsStatus: "red",      lastActive: "25.02"   },
  { id: 10, name: "Наталья Белова",   avatar: "НБ", avatarColor: "#f44336", department: "ВК",       role: "Инженер ВК",              balance: 1560, earnedThisMonth: 145, penaltiesThisMonth: 0,    wsStatus: "green",    lastActive: "Сегодня" },
  { id: 11, name: "Артём Соколов",    avatar: "АС", avatarColor: "#3f51b5", department: "ОВ",       role: "Инженер-проектировщик",   balance: 1320, earnedThisMonth: 95,  penaltiesThisMonth: 200,  wsStatus: "inactive", lastActive: "24.02"   },
  { id: 12, name: "Павел Громов",     avatar: "ПГ", avatarColor: "#8bc34a", department: "ТХ",       role: "Технолог",                balance: 980,  earnedThisMonth: 80,  penaltiesThisMonth: 100,  wsStatus: "red",      lastActive: "26.02"   },
  { id: 13, name: "Юлия Смирнова",    avatar: "ЮС", avatarColor: "#ff5722", department: "КР гражд", role: "Инженер-конструктор",     balance: 870,  earnedThisMonth: 75,  penaltiesThisMonth: 0,    wsStatus: "green",    lastActive: "Сегодня" },
  { id: 14, name: "Игорь Федоров",    avatar: "ИФ", avatarColor: "#009688", department: "ТМ",       role: "Инженер ТМ",              balance: 620,  earnedThisMonth: 55,  penaltiesThisMonth: 300,  wsStatus: "inactive", lastActive: "21.02"   },
];

export const adminStats = {
  totalEmployees: 14,
  totalBalanceInCirculation: 30100,
  issuedThisMonth: 2470,
  spentThisMonth: 3900,
  activeToday: 7,
  redDaysThisMonth: 8,
  penaltiesThisMonth: 1100,
};

// ===== АДМИН: ЛОГ СОБЫТИЙ =====
export const adminEventLog: AdminEvent[] = [
  { id: 1,  timestamp: "26.02 09:14", employee: "Иван Петров",     avatar: "ИП", avatarColor: "#4caf50", department: "КР гражд", type: "earning",     description: "Зелёный день Worksection",          amount: 3   },
  { id: 2,  timestamp: "26.02 09:02", employee: "Сергей Иванов",   avatar: "СИ", avatarColor: "#607d8b", department: "АР",       type: "earning",     description: "Зелёный день Worksection",          amount: 3   },
  { id: 3,  timestamp: "26.02 08:55", employee: "Мария Сидорова",  avatar: "МС", avatarColor: "#e91e63", department: "АР",       type: "earning",     description: "Зелёный день Worksection",          amount: 3   },
  { id: 4,  timestamp: "26.02 08:41", employee: "Наталья Белова",  avatar: "НБ", avatarColor: "#f44336", department: "ВК",       type: "earning",     description: "Зелёный день Worksection",          amount: 3   },
  { id: 5,  timestamp: "26.02 08:30", employee: "Ольга Новикова",  avatar: "ОН", avatarColor: "#9c27b0", department: "ОВ",       type: "penalty",     description: "Красный день: тайм-трекинг не внесён", amount: -100 },
  { id: 6,  timestamp: "25.02 18:45", employee: "Мария Сидорова",  avatar: "МС", avatarColor: "#e91e63", department: "АР",       type: "purchase",    description: "Покупка: Пицца на отдел",           amount: -1200 },
  { id: 7,  timestamp: "25.02 17:20", employee: "Дмитрий Волков",  avatar: "ДВ", avatarColor: "#ff9800", department: "КР гражд", type: "streak",      description: "Бонус серии: 7 зелёных дней подряд", amount: 20  },
  { id: 8,  timestamp: "25.02 16:05", employee: "Алексей Козлов",  avatar: "АК", avatarColor: "#2196f3", department: "ВК",       type: "achievement", description: "Достижение: Межфункциональное взаимодействие", amount: 0 },
  { id: 9,  timestamp: "25.02 14:33", employee: "Ольга Новикова",  avatar: "ОН", avatarColor: "#9c27b0", department: "ОВ",       type: "earning",     description: "Благодарность от И. Петрова",       amount: 10  },
  { id: 10, timestamp: "25.02 13:10", employee: "Павел Громов",    avatar: "ПГ", avatarColor: "#8bc34a", department: "ТХ",       type: "penalty",     description: "Красный день: статусы не обновлены", amount: -100 },
  { id: 11, timestamp: "25.02 11:55", employee: "Сергей Иванов",   avatar: "СИ", avatarColor: "#607d8b", department: "АР",       type: "earning",     description: "Зелёный день Worksection",          amount: 3   },
  { id: 12, timestamp: "25.02 11:40", employee: "Иван Петров",     avatar: "ИП", avatarColor: "#4caf50", department: "КР гражд", type: "earning",     description: "Зелёный день Worksection",          amount: 3   },
  { id: 13, timestamp: "25.02 10:15", employee: "Анна Петрова",    avatar: "АП", avatarColor: "#00bcd4", department: "АР",       type: "penalty",     description: "Красный день: тайм-трекинг не внесён", amount: -100 },
  { id: 14, timestamp: "25.02 09:50", employee: "Елена Морозова",  avatar: "ЕМ", avatarColor: "#00bcd4", department: "ТХ",       type: "earning",     description: "Зелёный день Worksection",          amount: 3   },
  { id: 15, timestamp: "24.02 17:30", employee: "Артём Соколов",   avatar: "АС", avatarColor: "#3f51b5", department: "ОВ",       type: "purchase",    description: "Покупка: Суши-сет на команду",      amount: -1800 },
  { id: 16, timestamp: "24.02 16:00", employee: "Михаил Кузнецов", avatar: "МК", avatarColor: "#795548", department: "ТМ",       type: "penalty",     description: "Красный день: тайм-трекинг не внесён", amount: -100 },
  { id: 17, timestamp: "24.02 12:20", employee: "Наталья Белова",  avatar: "НБ", avatarColor: "#f44336", department: "ВК",       type: "earning",     description: "Зелёный день Worksection",          amount: 3   },
  { id: 18, timestamp: "24.02 11:00", employee: "Юлия Смирнова",   avatar: "ЮС", avatarColor: "#ff5722", department: "КР гражд", type: "earning",     description: "Зелёный день Worksection",          amount: 3   },
  { id: 19, timestamp: "23.02 10:30", employee: "Михаил Кузнецов", avatar: "МК", avatarColor: "#795548", department: "ТМ",       type: "purchase",    description: "Покупка: Кофе от Григория",         amount: -3000 },
  { id: 20, timestamp: "23.02 09:15", employee: "Дмитрий Волков",  avatar: "ДВ", avatarColor: "#ff9800", department: "КР гражд", type: "achievement", description: "Достижение: Лидер автоматизации",   amount: 0   },
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
