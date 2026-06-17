# Matt Gaudet Personal Dashboard — Claude Code Context

## What this is
Personal life dashboard for Matt Gaudet. Gamified daily tracker covering health, habits,
finances, relationships, tasks, chores, and important dates. Single user (Matt). No auth.

## Build plan (source of truth)
See BUILD_PLAN.md for the full phased build plan and authoritative table schemas.
Original doc: docs/MattGaudetDashboard_BuildPlan.docx

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Drizzle ORM + Turso (hosted SQLite), deployed on Vercel (free Hobby plan)
- Zod for API input validation, date-fns for date math

## Environment variables (.env.local)
TURSO_DATABASE_URL, TURSO_AUTH_TOKEN

## Key files
- /lib/db.ts — Turso client
- /lib/schema.ts — Drizzle schema (11 tables)
- /lib/award-xp.ts — shared XP helper (ALL XP awards go through this, never update users directly)
- /lib/seed.ts — seed script for initial data

## Database tables
users, habits, habit_logs, tasks, budget_categories, budget_entries,
people, contact_logs, chores, chore_logs, important_dates, workout_logs, xp_log

## XP values
habit: 10 | task: 5 | relationship contact: 15 | chore: 8 | workout: 12
award-xp.ts updates current_xp, recomputes level, updates streak, writes xp_log

## Streak logic (in award-xp.ts)
streak_last_date on users row (ISO date string)
- yesterday → increment streak_count
- today → no change
- older → reset to 1
Always update streak_last_date = today

## Level thresholds (static in award-xp.ts)
Levels 1–5: 500 XP each | Levels 6–10: 1000 XP each | Levels 11+: 2000 XP each

## Money — store in cents
budget_categories.monthly_budget and budget_entries.amount: INTEGER cents, /100 for display
budget_entries.year_month = "YYYY-MM" string for fast month filtering

## Chore due date logic
next_due_date = completion_date + frequency_days (always from completion, not original due date)

## Urgency logic (relationships)
- overdue: days_since_contact > checkin_frequency_days
- soon: days_since_contact > (checkin_frequency_days * 0.7)
- good: otherwise

## Important dates — recurring
If is_recurring=1 and event_date < today: advance year by 1. Run in GET /api/dates.

## API routes
GET /api/today | POST /api/habits/[id]/log (409 if duplicate) | GET|POST /api/tasks
PATCH /api/tasks/[id] | GET /api/budget | POST /api/budget/entry | GET|POST /api/people
POST /api/people/[id]/contact | GET|POST /api/chores | PATCH /api/chores/[id]/done
GET|POST /api/dates | POST /api/health/workout

## Design rules
- Blue accent: #1A56A0 | Tailwind only, no custom CSS files
- Mobile-first, min tap target 44px | No gradients or card shadows
- Urgency: red = overdue, amber = soon, green = good

## Do NOT
- Add auth or user login
- Use float numbers for money (cents only)
- Update users.current_xp directly (use award-xp.ts)
- Write raw SQL (Drizzle query builder only)
