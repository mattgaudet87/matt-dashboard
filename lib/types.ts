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

// Re-export so client modules can import urgency unions from one place.
export type { RelationshipUrgency, DateUrgency };
