import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Shared helper for ISO created-at timestamps.
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`);

// ---------------------------------------------------------------------------
// users — single row (id = 1, Matt). Gamification state.
// XP/level/streak are ONLY mutated through lib/award-xp.ts.
// ---------------------------------------------------------------------------
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  currentXp: integer("current_xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streakCount: integer("streak_count").notNull().default(0),
  // ISO date string (YYYY-MM-DD) of the last day an action was logged.
  streakLastDate: text("streak_last_date"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// habits — one row per habit. Archived habits stay for history (10 XP each).
// ---------------------------------------------------------------------------
export const habits = sqliteTable("habits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // health / mindset / relationships / other
  category: text("category").notNull().default("other"),
  // daily / weekdays / custom
  frequencyType: text("frequency_type").notNull().default("daily"),
  // JSON array of day numbers if custom, e.g. "[1,3,5]". Null otherwise.
  frequencyDays: text("frequency_days"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// habit_logs — one row per completion. UNIQUE(habit_id, logged_date).
// ---------------------------------------------------------------------------
export const habitLogs = sqliteTable(
  "habit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    habitId: integer("habit_id")
      .notNull()
      .references(() => habits.id),
    // ISO date string (YYYY-MM-DD).
    loggedDate: text("logged_date").notNull(),
    xpAwarded: integer("xp_awarded").notNull().default(10),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("habit_logs_habit_date_unq").on(t.habitId, t.loggedDate)],
);

// ---------------------------------------------------------------------------
// tasks — completed tasks soft-deleted (status = done). 5 XP on completion.
// ---------------------------------------------------------------------------
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  // health / finance / family / home / personal / chore
  category: text("category").notNull().default("personal"),
  // normal / high
  priority: text("priority").notNull().default("normal"),
  // ISO date string (YYYY-MM-DD), nullable.
  dueDate: text("due_date"),
  notes: text("notes"),
  // open / done / archived
  status: text("status").notNull().default("open"),
  // ISO datetime, set when marked done.
  completedAt: text("completed_at"),
  // 5 when completed, else 0.
  xpAwarded: integer("xp_awarded").notNull().default(0),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// budget_categories — reusable, set up once. Money in INTEGER cents.
// ---------------------------------------------------------------------------
export const budgetCategories = sqliteTable("budget_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // Monthly budget in cents. For a "saving" category this is the monthly goal.
  monthlyBudget: integer("monthly_budget").notNull().default(0),
  // "spend" = normal spending category | "saving" = savings/investment goal.
  kind: text("kind").notNull().default("spend"),
  // Tabler icon name, e.g. "shopping-cart".
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// budget_entries — one row per spend. Money in INTEGER cents.
// ---------------------------------------------------------------------------
export const budgetEntries = sqliteTable("budget_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => budgetCategories.id),
  // Amount in cents.
  amount: integer("amount").notNull(),
  // ISO date string (YYYY-MM-DD).
  entryDate: text("entry_date").notNull(),
  // "YYYY-MM" for fast month filtering.
  yearMonth: text("year_month").notNull(),
  // "spend" (default) counts toward spending; "saving" is money added to savings.
  entryType: text("entry_type").notNull().default("spend"),
  note: text("note"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// people — relationship tracker. Urgency computed from MAX(contact_date)
// in contact_logs (there is intentionally no last_contact_date column).
// ---------------------------------------------------------------------------
export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // family / friend / partner / mentor / other
  relationshipType: text("relationship_type").notNull().default("friend"),
  // Target days between contacts (7 = weekly).
  checkinFrequencyDays: integer("checkin_frequency_days").notNull().default(30),
  notes: text("notes"),
  // Optional ISO date — also creates an important_dates row.
  birthday: text("birthday"),
  // Relationship context (free text).
  whenMet: text("when_met"),
  howMet: text("how_met"),
  sharedInterests: text("shared_interests"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// contact_logs — one row per contact (multiple same-day allowed). 15 XP.
// ---------------------------------------------------------------------------
export const contactLogs = sqliteTable("contact_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  // ISO date string (YYYY-MM-DD), editable, defaults to today.
  contactDate: text("contact_date").notNull(),
  note: text("note"),
  xpAwarded: integer("xp_awarded").notNull().default(15),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// chores — next_due_date advances by frequency_days from completion date.
// ---------------------------------------------------------------------------
export const chores = sqliteTable("chores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // Interval in days (7 = weekly, 30 = monthly).
  frequencyDays: integer("frequency_days").notNull(),
  // ISO date string (YYYY-MM-DD).
  nextDueDate: text("next_due_date").notNull(),
  notes: text("notes"),
  // 1 = recurring (advance next_due_date on completion); 0 = one-off (archive
  // on completion instead of advancing).
  isRepeating: integer("is_repeating").notNull().default(1),
  isActive: integer("is_active").notNull().default(1),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// chore_logs — audit trail only (not used for display logic). 8 XP.
// ---------------------------------------------------------------------------
export const choreLogs = sqliteTable("chore_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  choreId: integer("chore_id")
    .notNull()
    .references(() => chores.id),
  // ISO date string (YYYY-MM-DD).
  completedDate: text("completed_date").notNull(),
  xpAwarded: integer("xp_awarded").notNull().default(8),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// important_dates — recurring dates auto-advance year after they pass.
// ---------------------------------------------------------------------------
export const importantDates = sqliteTable("important_dates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  // ISO date string (YYYY-MM-DD).
  eventDate: text("event_date").notNull(),
  // birthday / anniversary / renewal / event / reminder
  type: text("type").notNull().default("event"),
  isRecurring: integer("is_recurring").notNull().default(0),
  // Days before to show the urgent badge (default 7).
  reminderOffsetDays: integer("reminder_offset_days").notNull().default(7),
  // Optional link to a person.
  personId: integer("person_id").references(() => people.id),
  isActive: integer("is_active").notNull().default(1),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// workout_logs — one row per workout. 12 XP.
// ---------------------------------------------------------------------------
export const workoutLogs = sqliteTable("workout_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // ISO date string (YYYY-MM-DD).
  workoutDate: text("workout_date").notNull(),
  // run / lift / bike / swim / other
  type: text("type").notNull().default("other"),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  xpAwarded: integer("xp_awarded").notNull().default(12),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// xp_log — append-only ledger of every XP award (written by award-xp.ts).
// ---------------------------------------------------------------------------
export const xpLog = sqliteTable("xp_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // habit / task / contact / chore / workout
  actionType: text("action_type").notNull(),
  xpAwarded: integer("xp_awarded").notNull(),
  // ID of the source row (habit_log.id, task.id, etc.), nullable.
  referenceId: integer("reference_id"),
  createdAt: createdAt(),
});
