# Matt's Personal Dashboard

A gamified personal life dashboard — health, habits, finances, relationships,
tasks, chores, and important dates in one mobile-first app. Single user, no auth.

Every logged action awards XP, advances a level, and feeds a daily streak, so the
boring stuff (workouts, check-ins, chores) turns into a game you can win each day.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS**
- **Drizzle ORM** on **Turso** (hosted SQLite)
- **Zod** for API input validation, **date-fns** for date math
- Deployed on **Vercel** (Hobby plan)

## Project layout

| Path | What it is |
|---|---|
| `app/` | App Router pages (Today, Health, Habits, People, Money, Settings) + `app/api/*` routes |
| `lib/db.ts` | Turso client |
| `lib/schema.ts` | Drizzle schema (11 tables) |
| `lib/award-xp.ts` | Shared XP helper — **all** XP awards go through this |
| `lib/domain.ts` | Pure domain logic (streaks, urgency, dot-grid status) |
| `lib/seed.ts` | Seed script for initial data |
| `BUILD_PLAN.md` | Phased build plan + authoritative table schemas |
| `CLAUDE.md` | Conventions and guardrails for this codebase |

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` with your Turso credentials:

   ```bash
   TURSO_DATABASE_URL="libsql://<your-db>.turso.io"
   TURSO_AUTH_TOKEN="<your-token>"
   ```

   Create a database and token with the [Turso CLI](https://docs.turso.tech/cli):

   ```bash
   turso db create matt-dashboard
   turso db show matt-dashboard --url      # → TURSO_DATABASE_URL
   turso db tokens create matt-dashboard   # → TURSO_AUTH_TOKEN
   ```

3. Push the schema and seed initial data:

   ```bash
   npm run db:push    # create tables from lib/schema.ts
   npm run db:seed    # user, habits, chores, people, dates, budget categories
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run db:push` | Push schema to Turso (`drizzle-kit push`) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Seed initial data |

## Deploying to Vercel

1. Push this repo to GitHub and **Import Project** in Vercel. Next.js is
   auto-detected; `vercel.json` pins the framework and build command.
2. In **Project → Settings → Environment Variables**, add the same two vars to
   the Production (and Preview) environments:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. Deploy. The schema/seed steps run against Turso directly (see above) — they
   are **not** part of the Vercel build, so push + seed before the first deploy.
4. On your phone, open the deployment URL and **Add to Home Screen** for an
   app-like, full-width experience.

## Conventions (see `CLAUDE.md` for the full list)

- Money is stored in **integer cents**, never floats; divide by 100 for display.
- XP/level/streak are mutated **only** through `lib/award-xp.ts`.
- All API writes are **Zod-validated**; queries use the Drizzle query builder
  (no raw SQL).
- Mobile-first, blue accent `#1A56A0`, 44px minimum tap targets, no gradients or
  card shadows.
