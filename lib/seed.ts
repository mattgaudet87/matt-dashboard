// Env (.env.local) is loaded via `node --env-file` in the db:seed script.
import { addDays, format } from "date-fns";
import { db } from "./db";
import {
  budgetCategories,
  chores,
  habits,
  importantDates,
  people,
  users,
} from "./schema";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const today = new Date();

async function seed() {
  console.log("Seeding database...");

  // --- user (id = 1, Matt) -------------------------------------------------
  await db
    .insert(users)
    .values({
      id: 1,
      name: "Matt Gaudet",
      currentXp: 0,
      level: 1,
      streakCount: 0,
      streakLastDate: null,
    })
    .onConflictDoNothing();

  // --- 4 habits ------------------------------------------------------------
  await db.insert(habits).values([
    { name: "Drink 2L of water", category: "health", frequencyType: "daily" },
    { name: "Read 20 minutes", category: "mindset", frequencyType: "daily" },
    { name: "Meditate", category: "mindset", frequencyType: "daily" },
    { name: "Call a friend or family member", category: "relationships", frequencyType: "weekdays" },
  ]);

  // --- 3 chores (next_due_date seeded from today + frequency_days) ----------
  await db.insert(chores).values([
    { name: "Take out trash", frequencyDays: 7, nextDueDate: iso(addDays(today, 7)) },
    { name: "Vacuum apartment", frequencyDays: 14, nextDueDate: iso(addDays(today, 14)) },
    { name: "Clean bathroom", frequencyDays: 10, nextDueDate: iso(addDays(today, 10)) },
  ]);

  // --- 4 people ------------------------------------------------------------
  await db.insert(people).values([
    { name: "Mom", relationshipType: "family", checkinFrequencyDays: 7 },
    { name: "Dad", relationshipType: "family", checkinFrequencyDays: 14 },
    { name: "Alex", relationshipType: "friend", checkinFrequencyDays: 30 },
    { name: "Sam", relationshipType: "friend", checkinFrequencyDays: 21 },
  ]);

  // --- 3 important dates ----------------------------------------------------
  await db.insert(importantDates).values([
    { title: "Mom's Birthday", eventDate: iso(addDays(today, 20)), type: "birthday", isRecurring: 1 },
    { title: "Wedding Anniversary", eventDate: iso(addDays(today, 60)), type: "anniversary", isRecurring: 1 },
    { title: "Dentist Appointment", eventDate: iso(addDays(today, 12)), type: "event", isRecurring: 0 },
  ]);

  // --- 3 budget categories (monthly_budget in cents) -----------------------
  await db.insert(budgetCategories).values([
    { name: "Groceries", monthlyBudget: 60000, icon: "shopping-cart", sortOrder: 1 }, // $600.00
    { name: "Dining", monthlyBudget: 20000, icon: "tools-kitchen-2", sortOrder: 2 }, // $200.00
    { name: "Entertainment", monthlyBudget: 10000, icon: "movie", sortOrder: 3 }, // $100.00
  ]);

  console.log("Seed complete ✅");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
