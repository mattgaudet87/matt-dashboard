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
GET|POST /api/budget/categories | PATCH /api/budget/categories/[id] | GET /api/xp

## Design rules (Dark Redesign 2026)
Dark, gamified theme. Tailwind v4 only; theme tokens live in app/globals.css.
- Background #0A0C12 | Surface (cards) #12141C | Card border 1px solid #1C1F2E | Card radius 18px (tight rows 13–16px) | No box-shadow on cards
- Accent / XP purple #7B61FF | Gold/Rewards #F5C842 | Fire/Streak #FF6B35 | Emerald/Done #2DD4A0 | Coral/Overdue #FF5254 | Sky/Health #5BB8FF
- Text: primary #EFF1F9 | muted #7A80A0 | dim #4A5070
- Font: Space Grotesk only (via next/font). Hero/greeting 700/26px, screen title 700/22px, hero numbers 700/28–36px, section heading 600/15px, body 500/13px, CAPS badge 600/10px
- Gradients ARE allowed on progress bars / XP ring / glows (e.g. budget bars #2DD4A0→#5BEAD4; XP ring #7B61FF→#A78BFA). XP bar always glows: box-shadow 0 0 8px rgba(123,97,255,.65)
- Mobile-first, min tap target 44px
- Nav: 5 tabs Home/Grow/People/Money/Me. Active = pill 44×28px, radius 999px, accent at 15% opacity; icon + label turn #7B61FF
- Animations: slideIn on each screen root (opacity 0→1 + translateY 8→0, 280ms), habit circle scale 1→1.25→1 on complete, persistent XP glow
- Urgency: coral #FF5254 = overdue, amber/gold = soon, emerald #2DD4A0 = good
- Spacing: screen padding 18–20px H, card gap 8–10px, inner card padding 13–16px, section gap 18–22px, nav height 80px

## Do NOT
- Add auth or user login
- Use float numbers for money (cents only)
- Update users.current_xp directly (use award-xp.ts)
- Write raw SQL (Drizzle query builder only)
