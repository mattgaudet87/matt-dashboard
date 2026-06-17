// Shared client/server types for the /api/today payload (the Today digest).
import type { RelationshipUrgency, DateUrgency } from "./domain";

export type HabitDotStatus =
  | "completed"
  | "today"
  | "missed"
  | "empty"
  | "future";

export interface TodayHabit {
  id: number;
  name: string;
  category: string;
  completedToday: boolean;
  expectedToday: boolean;
  week: { date: string; status: HabitDotStatus }[];
}

export interface TodayTask {
  id: number;
  title: string;
  category: string;
  priority: "normal" | "high";
  dueDate: string | null;
  notes: string | null;
  status: string;
  completedAt: string | null;
  xpAwarded: number;
  createdAt: string;
}

export interface TodayChore {
  id: number;
  name: string;
  frequencyDays: number;
  nextDueDate: string;
  notes: string | null;
  isActive: number;
  createdAt: string;
  overdue: boolean;
}

export interface TodayDate {
  id: number;
  title: string;
  type: string;
  eventDate: string;
  daysUntil: number;
  urgency: DateUrgency;
}

export interface TodayResponse {
  today: string;
  greeting: { name: string; timeOfDay: string };
  user: {
    currentXp: number;
    level: number;
    streakCount: number;
    progress: {
      level: number;
      levelStartXp: number;
      xpForLevel: number;
      xpIntoLevel: number;
      xpToNext: number;
    };
  } | null;
  stats: {
    healthScore: number;
    budget: { spent: number; budget: number; remaining: number };
    tasks: { done: number; total: number };
    relationshipsOverdue: number;
  };
  habits: TodayHabit[];
  tasks: TodayTask[];
  chores: TodayChore[];
  upcomingDates: TodayDate[];
  weekDays: string[];
}

// --- Habits page (/api/habits) --------------------------------------------
export interface HabitWeekDay {
  date: string;
  status: HabitDotStatus;
}

export interface HabitListItem {
  id: number;
  name: string;
  category: string;
  frequencyType: string;
  frequencyDays: string | null;
  isActive: number;
  completedToday: boolean;
  expectedToday: boolean;
  streak: number;
  week: HabitWeekDay[];
}

export interface HabitsResponse {
  today: string;
  weekDays: string[]; // Mon→Sun ISO dates
  habits: HabitListItem[];
}

// --- Health page (/api/health/workout GET) --------------------------------
export interface WorkoutLogItem {
  id: number;
  workoutDate: string;
  type: string;
  durationMinutes: number | null;
  notes: string | null;
  xpAwarded: number;
  createdAt: string;
}

export interface WeekBucket {
  weekStart: string; // ISO date of the Monday
  workouts: number;
  minutes: number;
}

export interface HealthResponse {
  today: string;
  healthScore: number;
  weekly: { workouts: number; minutes: number };
  weeks: WeekBucket[]; // oldest → newest, 8 buckets
  recent: WorkoutLogItem[];
}

// --- People page (/api/people) --------------------------------------------
export interface PersonListItem {
  id: number;
  name: string;
  relationshipType: string;
  checkinFrequencyDays: number;
  notes: string | null;
  birthday: string | null;
  whenMet: string | null;
  howMet: string | null;
  sharedInterests: string | null;
  isActive: number;
  createdAt: string;
  lastContactDate: string | null;
  daysSinceContact: number | null;
  urgency: RelationshipUrgency;
}

export interface PeopleResponse {
  people: PersonListItem[];
}

export interface ContactLogRow {
  id: number;
  personId: number;
  contactDate: string;
  note: string | null;
  xpAwarded: number;
  createdAt: string;
}

export interface ContactLogsResponse {
  logs: ContactLogRow[];
}

// --- Money page (/api/budget) ---------------------------------------------
export interface BudgetCategoryRow {
  id: number;
  name: string;
  monthlyBudget: number; // cents (monthly goal for saving categories)
  kind: "spend" | "saving";
  icon: string | null;
  sortOrder: number;
  isActive: number;
  createdAt: string;
  spent: number; // cents (amount saved for saving categories)
  remaining: number; // cents
  overBudget: boolean;
  goalMet: boolean; // saving categories: true once the goal is reached
}

export interface BudgetEntryRow {
  id: number;
  categoryId: number;
  amount: number; // cents
  entryDate: string;
  yearMonth: string;
  entryType: "spend" | "saving";
  note: string | null;
  createdAt: string;
}

export interface BudgetResponse {
  month: string; // YYYY-MM
  categories: BudgetCategoryRow[];
  entries: BudgetEntryRow[];
  totals: { budget: number; spent: number; remaining: number };
}

// --- Tasks page (/api/tasks) ----------------------------------------------
export interface TaskRow {
  id: number;
  title: string;
  category: string;
  priority: "normal" | "high";
  dueDate: string | null;
  notes: string | null;
  status: string;
  completedAt: string | null;
  xpAwarded: number;
  createdAt: string;
}

export interface TasksResponse {
  tasks: TaskRow[];
}

// --- Chores page (/api/chores) --------------------------------------------
export interface ChoreRow {
  id: number;
  name: string;
  frequencyDays: number;
  nextDueDate: string;
  notes: string | null;
  isRepeating: number;
  isActive: number;
  createdAt: string;
  dueToday: boolean;
  overdue: boolean;
}

export interface ChoresResponse {
  chores: ChoreRow[];
}

// --- Dates page (/api/dates) ----------------------------------------------
export interface DateRow {
  id: number;
  title: string;
  eventDate: string;
  type: string;
  isRecurring: number;
  reminderOffsetDays: number;
  personId: number | null;
  isActive: number;
  createdAt: string;
  daysUntil: number;
  urgency: DateUrgency;
}

export interface DatesResponse {
  dates: DateRow[];
}

// --- Settings: budget categories (/api/budget/categories) -----------------
export interface BudgetCategory {
  id: number;
  name: string;
  monthlyBudget: number; // cents
  kind: "spend" | "saving";
  icon: string | null;
  sortOrder: number;
  isActive: number;
  createdAt: string;
}

export interface BudgetCategoriesResponse {
  categories: BudgetCategory[];
}

// --- Settings: XP history (/api/xp) ---------------------------------------
export interface XpLogEntry {
  id: number;
  actionType: string;
  xpAwarded: number;
  referenceId: number | null;
  createdAt: string;
}

export interface XpByType {
  actionType: string;
  xp: number;
  count: number;
}

export interface XpDayPoint {
  date: string; // YYYY-MM-DD
  xp: number;
}

export interface XpSummary {
  total: number;
  week: number;
  month: number;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
  xpToNext: number;
}

export type XpRange = "week" | "month" | "3m" | "6m" | "1y" | "all";

export interface XpResponse {
  range?: XpRange;
  total: number;
  byType: XpByType[];
  series?: XpDayPoint[];
  recent: XpLogEntry[];
  summary?: XpSummary;
}

// Re-export so client modules can import urgency unions from one place.
export type { RelationshipUrgency, DateUrgency };
