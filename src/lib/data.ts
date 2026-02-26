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

export type WorksectionDayStatus = "green" | "red" | "gray" | "frozen";

export interface WorksectionDay {
  date: string;
  status: WorksectionDayStatus;
}

export interface WorksectionStreak {
  currentDays: number;
  calendarDays: WorksectionDay[];
  milestones: StreakMilestone[];
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
  description: "Ваша серия безупречной работы: 4 недели подряд",
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
    id: 1,
    severity: "critical",
    title: "Просрочка через 2 часа",
    description: "Задача не закрыта, дедлайн сегодня в 18:00",
    taskName: "Обновить модель 3-го этажа",
    deadline: "2026-02-26",
    penalty: -10,
  },
  {
    id: 2,
    severity: "warning",
    title: "Завтра дедлайн",
    description: "Не забудьте заполнить отчёт по задаче",
    taskName: "Ревизия фасада — блок Б",
    deadline: "2026-02-27",
    penalty: -5,
  },
];

// ===== СТРИКИ =====
function generateLast35Days(): WorksectionDay[] {
  const days: WorksectionDay[] = [];
  const now = new Date("2026-02-26");
  for (let i = 34; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    const dateStr = d.toISOString().split("T")[0];

    let status: WorksectionDayStatus;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      status = "gray";
    } else if (dateStr === "2026-02-10") {
      status = "red";
    } else if (dateStr >= "2026-02-02" && dateStr <= "2026-02-06") {
      status = "frozen";
    } else {
      status = "green";
    }
    days.push({ date: dateStr, status });
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
  currentDays: 28,
  calendarDays: generateLast35Days(),
  milestones: [
    { days: 7, reward: 20, reached: true },
    { days: 30, reward: 100, reached: false },
    { days: 90, reward: 500, reached: false },
  ],
};

// ===== ЕЖЕДНЕВНЫЕ ЗАДАНИЯ =====
export const dailyTasks: DailyTask[] = [
  {
    id: 1,
    source: "worksection",
    title: "Обновите 3 задачи в Worksection",
    description: "Актуализируйте статусы и сроки",
    reward: 15,
    icon: "📋",
    progress: 2,
    total: 3,
    completed: false,
  },
  {
    id: 2,
    source: "revit",
    title: "Используйте автоматизацию Revit",
    description: "Запустите любой скрипт автоматизации",
    reward: 20,
    icon: "⚡",
    progress: 1,
    total: 1,
    completed: true,
  },
  {
    id: 3,
    source: "social",
    title: "Отправьте благодарность коллеге",
    description: "Отметьте того, кто помог вам сегодня",
    reward: 10,
    icon: "🤝",
    progress: 0,
    total: 1,
    completed: false,
  },
  {
    id: 4,
    source: "worksection",
    title: "Закройте задачу до дедлайна",
    description: "Завершите задачу минимум за 1 день до срока",
    reward: 25,
    icon: "🎯",
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
    description: "Зелёный день Worksection",
    amount: 1,
    date: "Сегодня",
    icon: "🟢",
  },
  {
    id: 2,
    source: "revit",
    category: "daily_green",
    description: "Зелёный день Revit — запуск плагина",
    amount: 1,
    date: "Сегодня",
    icon: "⚡",
  },
  {
    id: 3,
    source: "social",
    category: "gratitude_received",
    description: "Благодарность от А. Петрова",
    amount: 10,
    date: "Сегодня",
    icon: "🤝",
  },
  {
    id: 4,
    source: "revit",
    category: "streak_bonus",
    description: "Бонус: серия 7 дней Revit",
    amount: 10,
    date: "Вчера",
    icon: "🔥",
  },
  {
    id: 5,
    source: "worksection",
    category: "deadline_penalty",
    description: "Штраф: просрочена задача «Отчёт BIM»",
    amount: -5,
    date: "23 февр.",
    icon: "⏰",
  },
  {
    id: 6,
    source: "worksection",
    category: "streak_bonus",
    description: "Бонус: серия 30 дней Worksection",
    amount: 100,
    date: "20 февр.",
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
  { name: "Дисциплина Worksection", value: 60, color: "#4CAF50" },
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
  { id: 1, title: "Обновите 3 задачи в Worksection", description: "Актуализируйте статусы и сроки", reward: 15, icon: "📋", progress: 2, total: 3, completed: false },
  { id: 2, title: "Отправьте благодарность коллеге", description: "Отметьте того, кто помог вам сегодня", reward: 10, icon: "🤝", progress: 0, total: 1, completed: false },
  { id: 3, title: "Используйте автоматизацию Revit", description: "Запустите любой скрипт автоматизации", reward: 20, icon: "⚡", progress: 1, total: 1, completed: true },
  { id: 4, title: "Закройте задачу до дедлайна", description: "Завершите задачу минимум за 1 день до срока", reward: 25, icon: "🎯", progress: 0, total: 1, completed: false },
];

export const teamActivity = [
  { id: 1, user: "Мария Сидорова", avatar: "МС", avatarColor: "#e91e63", action: "купила", target: "Пицца на отдел", emoji: "🍕", time: "5 минут назад", type: "purchase" as const },
  { id: 2, user: "Алексей Козлов", avatar: "АК", avatarColor: "#2196f3", action: "получил ачивку", target: "Месяц дисциплины", emoji: "🏅", time: "32 минуты назад", type: "achievement" as const },
  { id: 3, user: "Ольга Новикова", avatar: "ОН", avatarColor: "#9c27b0", action: "отправила благодарность", target: "Ивану Петрову", emoji: "💚", time: "1 час назад", type: "gratitude" as const },
  { id: 4, user: "Дмитрий Волков", avatar: "ДВ", avatarColor: "#ff9800", action: "заработал", target: "+120 за автоматизацию Revit", emoji: "⚡", time: "1 час назад", type: "earning" as const },
  { id: 5, user: "Анна Петрова", avatar: "АП", avatarColor: "#4caf50", action: "купила", target: "Сертификат Ozon", emoji: "🎫", time: "2 часа назад", type: "purchase" as const },
  { id: 6, user: "Сергей Иванов", avatar: "СИ", avatarColor: "#607d8b", action: "достиг серии", target: "8 зелёных недель подряд", emoji: "🔥", time: "3 часа назад", type: "streak" as const },
  { id: 7, user: "Елена Морозова", avatar: "ЕМ", avatarColor: "#00bcd4", action: "получила ачивку", target: "Щедрая душа", emoji: "💚", time: "3 часа назад", type: "achievement" as const },
  { id: 8, user: "Михаил Кузнецов", avatar: "МК", avatarColor: "#795548", action: "купил", target: "Кофе от Григория", emoji: "☕", time: "5 часов назад", type: "purchase" as const },
  { id: 9, user: "Наталья Белова", avatar: "НБ", avatarColor: "#f44336", action: "отправила благодарность", target: "Сергею Иванову", emoji: "🤝", time: "5 часов назад", type: "gratitude" as const },
  { id: 10, user: "Артём Соколов", avatar: "АС", avatarColor: "#3f51b5", action: "купил", target: "Суши-сет на команду", emoji: "🍣", time: "Вчера", type: "purchase" as const },
  { id: 11, user: "Мария Сидорова", avatar: "МС", avatarColor: "#e91e63", action: "заработала", target: "+50 за зелёную неделю", emoji: "🟢", time: "Вчера", type: "earning" as const },
  { id: 12, user: "Дмитрий Волков", avatar: "ДВ", avatarColor: "#ff9800", action: "получил ачивку", target: "Тысячник", emoji: "💰", time: "Вчера", type: "achievement" as const },
];

export const operationsHistory = [
  { date: "25.02.2026", operation: "Зеленая неделя Worksection", amount: 50 },
  { date: "25.02.2026", operation: "Благодарность от А. Петрова", amount: 50 },
  { date: "24.02.2026", operation: "Автоматизация Revit — модель этажа", amount: 120 },
  { date: "22.02.2026", operation: "Покупка: Пицца на отдел", amount: -1200 },
  { date: "20.02.2026", operation: "Зеленая неделя Worksection", amount: 50 },
  { date: "18.02.2026", operation: "Автоматизация Revit — фасад", amount: 80 },
  { date: "15.02.2026", operation: "Благодарность от М. Сидоровой", amount: 50 },
  { date: "13.02.2026", operation: "Зеленая неделя Worksection", amount: 50 },
  { date: "10.02.2026", operation: "Автоматизация Revit — инженерные сети", amount: 150 },
  { date: "08.02.2026", operation: "Покупка: Сертификат Ozon", amount: -500 },
];
