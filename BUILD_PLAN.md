# Matt Gaudet Personal Dashboard — Full Build Plan & Claude Code Handoff

> Wolf Creative Studio | June 2026 | Build Plan v1.0
> Source of truth for this project. The original `.docx` lives in [docs/MattGaudetDashboard_BuildPlan.docx](docs/MattGaudetDashboard_BuildPlan.docx).

| Field | Value |
|---|---|
| Project | Matt Gaudet Personal Dashboard |
| Purpose | Gamified personal life OS — health, habits, finance, relationships, tasks, chores, dates |
| User | Matt Gaudet (single user, private) |
| Hosting | Vercel (free Hobby plan) |
| Database | Turso (hosted SQLite, free tier) |
| Stack | Next.js + TypeScript + Tailwind CSS + Drizzle ORM |
| Auth | None — private URL, single user |
| Phase 2+ | Garmin/Strava API, Google Calendar sync, weekly digest email |

> **Stack note:** the plan specifies Next.js 15; this build uses **Next.js 16** (current stable at scaffold time). App Router APIs are compatible.

---

## 1. Project Purpose

A hosted web app that acts as a daily personal life operating system. Keeps Matt accountable across health, habits, finances, relationships, tasks, chores, and important dates through one unified interface on any device.

The gamification layer (XP, levels, streaks) turns daily maintenance into a system with momentum. This is **not** a work productivity tool — Wolf Creative tools cover work; this covers everything else.

---

## 2. Feature Breakdown

### 2.1 Today View (Home)
Read-only live digest — no data entered here. Shows:
- Greeting with date + time of day (morning/afternoon/evening)
- XP bar — current XP toward next level, level number, streak count
- Four stat cards: Health Score (weekly avg), Budget Remaining (current month), Tasks Done Today (X of Y), Relationships Needing Check-In (overdue count)
- Habits section — today's habits with tap-to-complete checkbox; dots show this week's history
- Tasks section — today's tasks due/flagged
- Chores section — chores due today or overdue (red)
- Upcoming Dates — next 3 dates with urgency badges

Data sources (all read): habits + habit_logs, tasks, chores, budget categories + entries, people + contact_logs, important_dates, user XP row.

### 2.2 Health & Fitness
Manual entry (no sync in Phase 1). Strava quick-link button (no OAuth — Phase 2 adds API).
- **Logs:** workout (date, type run/lift/bike/swim/other, duration mins, notes); optional body metrics (weight, RHR)
- **Calculates:** Health Score (weekly 0–100: workouts logged ≤3 = 60 pts, 10 pt streak bonus if 7-day streak active, health-tagged habit completions ≤30 pts); weekly activity summary + 8-week chart

### 2.3 Habit Tracker
7-day completion grid; awards XP + streak per completion.
- **Create:** name, category (health/mindset/relationships/other), target frequency (daily default / weekdays / custom days), active/archived
- **Log:** tap checkbox → writes habit_logs row (habit_id, logged_date, xp_awarded=10). Cannot double-log same habit same day (button disables)
- **Streak:** per-habit streak increments on consecutive expected days, resets to 0 on miss. Global streak = consecutive days with ≥1 habit completed
- **Dot grid:** Mon–Sun current week; filled (completed) / outlined (today, not logged) / empty (missed)

### 2.4 Tasks & To-Dos
Simple personal to-do list (not a project manager).
- **Fields:** title, category (health/finance/family/home/personal/chore — visual only), due_date (optional), priority (normal/high), notes, status (open/done/archived)
- Today view shows tasks due today or high-priority. Completing awards 5 XP → done. Done tasks hidden after 24h (accessible via Completed filter)

### 2.5 Finances
Manual monthly budget tracker (no bank connection).
- **Setup:** categories (Rent, Groceries, Transport, Subscriptions, Dining, Entertainment, Other) each with monthly_budget; reusable across months
- **Log spend:** date, category, amount, optional note → budget_entries with year_month context
- **Calculates:** total spent per category this month, remaining = budget − spent, total remaining on Today card, over-budget categories red
- **Month nav:** defaults to current month, arrows to review past. Each month independent, no rollover in Phase 1

### 2.6 Relationships
- **Add person:** name, relationship type (family/friend/partner/mentor/other), check-in frequency (3 days/weekly/2 weeks/monthly/quarterly), notes, optional birthday (auto-creates important_dates row)
- **Log contact:** tap → contact_logs row (person_id, contact_date defaults today/editable, optional note). Awards **15 XP** (highest action — relationships are the priority)
- **Urgency:** `days_since_contact = today − MAX(contact_date)`. overdue (red) if > frequency; soon (amber) if > frequency×0.7; else good (green). Today badge = count overdue

### 2.7 Chores
- **Add:** name, frequency (daily/weekly/bi-weekly/monthly/quarterly/custom X days), notes
- **Due dates:** on create, next_due_date = today. On done, next_due_date advances by frequency **from completion date** (not original due date) — prevents catch-up backlog
- Today view shows chores with next_due_date ≤ today; overdue (< today) get red badge

### 2.8 Important Dates
- **Add:** title, date, type (birthday/anniversary/renewal/event/reminder), recurring (yes auto-advances year after passing), optional person link, reminder_offset (default 7 days)
- **Urgency:** `days_until = date − today`. urgent (red) if ≤ reminder_offset; soon (amber) if ≤ 30; else normal. Past non-recurring → inactive; past recurring → year auto-increments

### 2.9 Gamification — XP, Levels & Streaks
**XP per action:** habit 10 | task 5 | relationship contact 15 | chore 8 | workout 12

**Level thresholds** (static lookup in code, not DB): Levels 1–5 = 500 XP each | 6–10 = 1,000 each | 11+ = 2,000 each

**Global streak:** consecutive calendar days with ≥1 action (habit/task/contact/chore/workout). `streak_last_date` on user row. On each action: if = yesterday increment; if = today no change; if older reset to 1.

**XP history:** every award writes xp_log (action_type, xp_awarded, reference_id, created_at).

---

## 3. Data Architecture

Turso (hosted SQLite) via Drizzle ORM — no raw SQL. No auth; single-user, `users` has exactly one row. Money stored in **INTEGER cents**. Dates are ISO strings.

### users — one row, identity + gamification state
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Always 1 |
| name | TEXT | Matt Gaudet |
| current_xp | INTEGER | Total XP all time |
| level | INTEGER | Computed from XP thresholds |
| streak_count | INTEGER | Current global streak |
| streak_last_date | TEXT | ISO date of last action |
| created_at | TEXT | ISO datetime |

### habits — one row per habit (archived stay for history)
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | e.g. Drink 2L water |
| category | TEXT | health / mindset / relationships / other |
| frequency_type | TEXT | daily / weekdays / custom |
| frequency_days | TEXT | JSON array of day nums if custom, e.g. [1,3,5] |
| is_active | INTEGER | 1 = active, 0 = archived |
| created_at | TEXT | ISO datetime |

### habit_logs — one row per completion. UNIQUE(habit_id, logged_date)
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| habit_id | INTEGER FK | → habits.id |
| logged_date | TEXT | ISO date (YYYY-MM-DD) |
| xp_awarded | INTEGER | Always 10 |
| created_at | TEXT | ISO datetime |

### tasks — completed tasks soft-deleted (status=done)
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| title | TEXT | |
| category | TEXT | health / finance / family / home / personal / chore |
| priority | TEXT | normal / high |
| due_date | TEXT | Optional ISO date |
| notes | TEXT | Optional |
| status | TEXT | open / done / archived |
| completed_at | TEXT | ISO datetime when done |
| xp_awarded | INTEGER | 5 when completed, else 0 |
| created_at | TEXT | ISO datetime |

### budget_categories — reusable, set up once
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | e.g. Groceries |
| monthly_budget | INTEGER | Cents |
| icon | TEXT | Tabler icon name, e.g. shopping-cart |
| sort_order | INTEGER | Display order |
| is_active | INTEGER | 1 = active, 0 = hidden |
| created_at | TEXT | ISO datetime |

### budget_entries — one row per spend
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| category_id | INTEGER FK | → budget_categories.id |
| amount | INTEGER | Cents |
| entry_date | TEXT | ISO date |
| year_month | TEXT | YYYY-MM — indexed for fast month queries |
| note | TEXT | Optional |
| created_at | TEXT | ISO datetime |

### people — one row per tracked person
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | |
| relationship_type | TEXT | family / friend / partner / mentor / other |
| checkin_frequency_days | INTEGER | Target days between contacts |
| notes | TEXT | Optional |
| birthday | TEXT | Optional ISO date — also creates important_dates row |
| is_active | INTEGER | 1 = tracking, 0 = archived |
| created_at | TEXT | ISO datetime |

> Note: there is **no** last_contact_date column — urgency is computed from `MAX(contact_date)` in contact_logs.

### contact_logs — one row per contact (multiple same-day allowed)
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| person_id | INTEGER FK | → people.id |
| contact_date | TEXT | ISO date (editable, defaults today) |
| note | TEXT | Optional |
| xp_awarded | INTEGER | Always 15 |
| created_at | TEXT | ISO datetime |

### chores — next_due_date advances on completion
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | e.g. Take out trash |
| frequency_days | INTEGER | 7 = weekly, 30 = monthly |
| next_due_date | TEXT | ISO date |
| notes | TEXT | Optional |
| is_active | INTEGER | 1 = active, 0 = archived |
| created_at | TEXT | ISO datetime |

### chore_logs — audit trail only
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| chore_id | INTEGER FK | → chores.id |
| completed_date | TEXT | ISO date |
| xp_awarded | INTEGER | Always 8 |
| created_at | TEXT | ISO datetime |

### important_dates — recurring auto-advance year
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| title | TEXT | e.g. Dad's birthday |
| event_date | TEXT | ISO date |
| type | TEXT | birthday / anniversary / renewal / event / reminder |
| is_recurring | INTEGER | 1 = auto-advance year, 0 = one-time |
| reminder_offset_days | INTEGER | Days before to show urgent badge (default 7) |
| person_id | INTEGER FK | Optional → people.id |
| is_active | INTEGER | 1 = active, 0 = past/dismissed |
| created_at | TEXT | ISO datetime |

### workout_logs — one row per workout
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| workout_date | TEXT | ISO date |
| type | TEXT | run / lift / bike / swim / other |
| duration_minutes | INTEGER | |
| notes | TEXT | Optional |
| xp_awarded | INTEGER | Always 12 |
| created_at | TEXT | ISO datetime |

### xp_log — audit of every XP award
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| action_type | TEXT | habit / task / contact / chore / workout |
| xp_awarded | INTEGER | Amount awarded |
| reference_id | INTEGER | ID of source row (habit_log.id, task.id, etc.) |
| created_at | TEXT | ISO datetime |

---

## 4. Tech Stack
Next.js (App Router), TypeScript, Tailwind CSS, Drizzle ORM, Turso (hosted SQLite), Vercel (Hobby), Zod (API validation), date-fns (date math).

---

## 5. Build Phases
One phase per Claude Code session. Complete → test in browser → commit → fresh session.

- **Phase 1 — Scaffold, schema, seed:** Next.js + Tailwind, /lib/db.ts, /lib/schema.ts (all tables), drizzle-kit push, /lib/seed.ts (user, 4 habits, 3 chores, 4 people, 3 dates, 3 budget categories). *Commit:* `Phase 1: Scaffold, schema, seed`
- **Phase 2 — API layer:** GET /api/today; POST /api/habits/[id]/log (409 if dup); GET/POST/PATCH /api/tasks; GET /api/budget + POST /api/budget/entry; GET/POST /api/people + POST /api/people/[id]/contact; GET/POST /api/chores + PATCH /api/chores/[id]/done; GET/POST /api/dates; POST /api/health/workout; **/lib/award-xp.ts** shared helper. Zod-validate all writes. *Commit:* `Phase 2: API layer complete`
- **Phase 3 — Today view + nav shell:** /app/layout.tsx bottom nav (Today, Health, Habits, People, Money, Settings), XP/streak header on all pages, Today page wired to /api/today, habit + chore completion, empty states. *Commit:* `Phase 3: Today view + nav shell`
- **Phase 4 — Habits + Health pages:** Habits page (7-day DotGrid, add/archive), reusable DotGrid component, Health page (log workout, recent list, weekly health score, Strava link). *Commit:* `Phase 4: Habits + Health pages`
- **Phase 5 — People, Money, Dates, Chores, Tasks pages:** full CRUD for each. *Commit:* `Phase 5: People, Money, Dates, Chores, Tasks pages`
- **Phase 6 — Settings + Vercel deploy:** settings (budget/habits/people/XP history), vercel.json, env vars in Vercel, deploy, mobile test, README. *Commit:* `Phase 6: Settings + Vercel deploy live`
- **Phase 7 — Polish:** loading/error/empty states, mobile audit @390px, streak edge cases, recurring-date auto-advance, README review. *Commit:* `Phase 7: Polish — production ready`

---

## 6. Workflow Notes
- One phase per session; commit after each phase before the next.
- Default model in plan: Sonnet/Medium; escalate to Opus/High for Phase 2 if needed.
- After each phase: click through in browser; if broken, describe what you see (not guesses).

## 7. Phase 2+ Roadmap (post-launch)
Strava API, Garmin Connect sync, Google Calendar sync, weekly digest email, savings goals, mobile PWA (manifest.json), daily push notifications.
