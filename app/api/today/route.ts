// GET /api/today — read-only digest powering the Today home view. No writes.
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  getDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import { eq, gte } from "drizzle-orm";
import { jsonOk } from "@/lib/api";
import { levelProgress } from "@/lib/award-xp";
import { db } from "@/lib/db";
import {
  advanceRecurringDate,
  computeHealthScore,
  dateUrgency,
  daysUntil,
  effectiveStreak,
  isHabitExpectedOn,
  relationshipUrgency,
  todayIso,
} from "@/lib/domain";
import {
  budgetCategories,
  budgetEntries,
  chores,
  contactLogs,
  habitLogs,
  habits,
  importantDates,
  people,
  tasks,
  users,
  workoutLogs,
} from "@/lib/schema";

export async function GET() {
  const today = todayIso();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekStartIso = format(weekStart, "yyyy-MM-dd");
  const month = today.slice(0, 7); // YYYY-MM

  // --- user / gamification ---
  const [user] = await db.select().from(users).where(eq(users.id, 1));
  const progress = user ? levelProgress(user.currentXp) : null;
  // Display streak: stored count while alive, 0 once it has lapsed (see domain).
  const streak = user ? effectiveStreak(user.streakCount, user.streakLastDate, today) : 0;

  // --- pull the data sets we need (mostly small, single-user) ---
  const [
    activeHabits,
    weekHabitLogs,
    allTasks,
    activeChores,
    activeCategories,
    monthEntries,
    activePeople,
    allContactLogs,
    activeDates,
    weekWorkouts,
  ] = await Promise.all([
    db.select().from(habits).where(eq(habits.isActive, 1)),
    db.select().from(habitLogs).where(gte(habitLogs.loggedDate, weekStartIso)),
    db.select().from(tasks),
    db.select().from(chores).where(eq(chores.isActive, 1)),
    db.select().from(budgetCategories).where(eq(budgetCategories.isActive, 1)),
    db.select().from(budgetEntries).where(eq(budgetEntries.yearMonth, month)),
    db.select().from(people).where(eq(people.isActive, 1)),
    db.select().from(contactLogs),
    db.select().from(importantDates).where(eq(importantDates.isActive, 1)),
    db.select().from(workoutLogs).where(gte(workoutLogs.workoutDate, weekStartIso)),
  ]);

  // --- habits with this week's dot grid (Mon–Sun) ---
  const weekDays = eachDayOfInterval({ start: weekStart, end: now }).map((d) =>
    format(d, "yyyy-MM-dd"),
  );
  // Full Mon–Sun week for the grid layout.
  const fullWeek = Array.from({ length: 7 }, (_, i) =>
    format(
      new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i),
      "yyyy-MM-dd",
    ),
  );

  const habitLogSet = new Set(weekHabitLogs.map((l) => `${l.habitId}:${l.loggedDate}`));
  const habitById = new Map(activeHabits.map((h) => [h.id, h]));

  const habitsToday = activeHabits.map((h) => {
    const week = fullWeek.map((date) => {
      const completed = habitLogSet.has(`${h.id}:${date}`);
      const weekday = getDay(parseISO(date)); // 0 = Sun … 6 = Sat
      const expected = isHabitExpectedOn(h.frequencyType, h.frequencyDays, weekday);
      let status: "completed" | "today" | "missed" | "empty" | "future";
      if (date > today) status = "future";
      else if (completed) status = "completed";
      else if (date === today) status = "today";
      else status = expected ? "missed" : "empty";
      return { date, status };
    });
    return {
      id: h.id,
      name: h.name,
      category: h.category,
      completedToday: habitLogSet.has(`${h.id}:${today}`),
      expectedToday: isHabitExpectedOn(h.frequencyType, h.frequencyDays, getDay(now)),
      week,
    };
  });

  // --- tasks for today (due today/overdue or high priority, still open) ---
  const openTasks = allTasks.filter((t) => t.status === "open");
  const todaysTasks = openTasks.filter(
    (t) => (t.dueDate && t.dueDate <= today) || t.priority === "high",
  );
  const doneToday = allTasks.filter(
    (t) => t.status === "done" && t.completedAt?.slice(0, 10) === today,
  ).length;
  const openDueToday = openTasks.filter((t) => t.dueDate === today).length;

  // --- chores due today or overdue ---
  const choresDue = activeChores
    .filter((c) => c.nextDueDate <= today)
    .map((c) => ({ ...c, overdue: c.nextDueDate < today }));

  // --- budget (current month) ---
  const spentByCategory = new Map<number, number>();
  for (const e of monthEntries) {
    spentByCategory.set(e.categoryId, (spentByCategory.get(e.categoryId) ?? 0) + e.amount);
  }
  // Spending totals exclude savings categories entirely — matches /api/budget,
  // so "Budget Left" on Home and "Remaining" on Money agree.
  let totalBudget = 0;
  let totalSpent = 0;
  for (const c of activeCategories) {
    if (c.kind === "saving") continue;
    totalBudget += c.monthlyBudget;
    totalSpent += spentByCategory.get(c.id) ?? 0;
  }

  // --- relationships needing check-in (overdue count) ---
  const lastContact = new Map<number, string>();
  for (const log of allContactLogs) {
    const prev = lastContact.get(log.personId);
    if (!prev || log.contactDate > prev) lastContact.set(log.personId, log.contactDate);
  }
  let overdueCount = 0;
  for (const p of activePeople) {
    const last = lastContact.get(p.id);
    const daysSince = last
      ? differenceInCalendarDays(parseISO(today), parseISO(last))
      : null;
    const urgency =
      daysSince === null ? "overdue" : relationshipUrgency(daysSince, p.checkinFrequencyDays);
    if (urgency === "overdue") overdueCount += 1;
  }

  // --- upcoming dates (next 3, recurring advanced for display) ---
  const upcomingDates = activeDates
    .map((d) => {
      const eventDate = advanceRecurringDate(d.eventDate, d.isRecurring, today);
      const days = daysUntil(eventDate, today);
      return {
        id: d.id,
        title: d.title,
        type: d.type,
        eventDate,
        daysUntil: days,
        urgency: dateUrgency(days, d.reminderOffsetDays),
      };
    })
    .filter((d) => d.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 3);

  // --- health score (weekly) ---
  const healthHabitIds = new Set(
    activeHabits.filter((h) => h.category === "health").map((h) => h.id),
  );
  const healthHabitCompletions = weekHabitLogs.filter(
    (l) => healthHabitIds.has(l.habitId) || habitById.get(l.habitId)?.category === "health",
  ).length;
  const healthScore = computeHealthScore({
    workoutsThisWeek: weekWorkouts.length,
    healthHabitCompletionsThisWeek: healthHabitCompletions,
    streakActive: streak >= 7,
  });

  // --- time-of-day greeting ---
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  return jsonOk({
    today,
    greeting: { name: user?.name ?? "there", timeOfDay },
    user: user
      ? {
          currentXp: user.currentXp,
          level: user.level,
          streakCount: streak,
          progress,
        }
      : null,
    stats: {
      healthScore,
      budget: { spent: totalSpent, budget: totalBudget, remaining: totalBudget - totalSpent },
      tasks: { done: doneToday, total: doneToday + openDueToday },
      relationshipsOverdue: overdueCount,
    },
    habits: habitsToday,
    tasks: todaysTasks,
    chores: choresDue,
    upcomingDates,
    weekDays, // Mon→today, useful for grid headers
  });
}
