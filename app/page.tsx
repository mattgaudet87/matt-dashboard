"use client";

import { useState } from "react";
import Link from "next/link";
import { useDashboard } from "./providers";
import DotGrid from "./components/DotGrid";
import { formatMoney, relativeDays } from "@/lib/format";
import type {
  TodayChore,
  TodayDate,
  TodayHabit,
  TodayTask,
} from "@/lib/types";

export default function TodayPage() {
  const { data, loading, error, refresh } = useDashboard();
  const [pending, setPending] = useState<Set<string>>(new Set());

  function setPendingKey(key: string, on: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function act(key: string, url: string, method: string) {
    setPendingKey(key, true);
    try {
      const res = await fetch(url, { method });
      // 409 (already logged) is a no-op success for our purposes.
      if (res.ok || res.status === 409) await refresh();
    } finally {
      setPendingKey(key, false);
    }
  }

  if (loading && !data) {
    return <p className="py-12 text-center text-slate-400">Loading your day…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Couldn’t load your dashboard.</p>
        <button
          onClick={refresh}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { greeting, stats, habits, tasks, chores, upcomingDates } = data;
  const overBudget = stats.budget.remaining < 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">
          Good {greeting.timeOfDay}, {greeting.name.split(" ")[0]}.
        </h1>
        <p className="text-sm text-slate-500">Here’s your day at a glance.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Health Score" value={`${stats.healthScore}`} sub="of 100 this week" />
        <StatCard
          label="Budget Left"
          value={formatMoney(stats.budget.remaining)}
          sub="this month"
          tone={overBudget ? "red" : "default"}
        />
        <StatCard
          label="Tasks Done"
          value={`${stats.tasks.done} / ${stats.tasks.total}`}
          sub="today"
        />
        <StatCard
          label="Check-Ins Due"
          value={`${stats.relationshipsOverdue}`}
          sub="people overdue"
          tone={stats.relationshipsOverdue > 0 ? "red" : "default"}
        />
      </div>

      {/* Habits */}
      <Section title="Habits">
        {habits.length === 0 ? (
          <Empty>No habits yet. Add some on the Habits tab.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {habits.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                pending={pending.has(`habit:${h.id}`)}
                onComplete={() => act(`habit:${h.id}`, `/api/habits/${h.id}/log`, "POST")}
              />
            ))}
          </ul>
        )}
      </Section>

      {/* Tasks */}
      <Section title="Today’s Tasks" href="/tasks">
        {tasks.length === 0 ? (
          <Empty>Nothing due today. 🎉</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} today={data.today} />
            ))}
          </ul>
        )}
      </Section>

      {/* Chores */}
      <Section title="Chores Due" href="/chores">
        {chores.length === 0 ? (
          <Empty>No chores due today. 🎉</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {chores.map((c) => (
              <ChoreRow
                key={c.id}
                chore={c}
                pending={pending.has(`chore:${c.id}`)}
                onComplete={() => act(`chore:${c.id}`, `/api/chores/${c.id}/done`, "PATCH")}
              />
            ))}
          </ul>
        )}
      </Section>

      {/* Upcoming dates */}
      <Section title="Upcoming Dates" href="/dates">
        {upcomingDates.length === 0 ? (
          <Empty>No dates coming up.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcomingDates.map((d) => (
              <DateRow key={d.id} date={d} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// --- presentational pieces -------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "red";
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === "red" ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-500">{title}</h2>
        {href && (
          <Link href={href} className="text-xs font-medium text-accent">
            View all →
          </Link>
        )}
      </div>
      <div className="rounded-xl bg-white p-1">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-4 text-center text-sm text-slate-400">{children}</p>;
}

function HabitRow({
  habit,
  pending,
  onComplete,
}: {
  habit: TodayHabit;
  pending: boolean;
  onComplete: () => void;
}) {
  const done = habit.completedToday;
  return (
    <li className="flex items-center gap-3 px-2 py-2">
      <button
        onClick={onComplete}
        disabled={done || pending}
        aria-label={done ? `${habit.name} completed` : `Complete ${habit.name}`}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-lg ${
          done
            ? "border-accent bg-accent text-white"
            : "border-slate-300 text-transparent active:bg-slate-50"
        } disabled:opacity-60`}
      >
        ✓
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${done ? "text-slate-400 line-through" : ""}`}>
          {habit.name}
        </p>
        <div className="mt-1">
          <DotGrid week={habit.week} />
        </div>
      </div>
    </li>
  );
}

function TaskRow({ task, today }: { task: TodayTask; today: string }) {
  const overdue = task.dueDate !== null && task.dueDate < today;
  return (
    <li className="flex items-center gap-2 px-3 py-2.5">
      {task.priority === "high" && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
          High
        </span>
      )}
      <span className="flex-1 truncate text-sm">{task.title}</span>
      {task.dueDate && (
        <span className={`text-xs ${overdue ? "text-red-600" : "text-slate-400"}`}>
          {overdue ? "overdue" : "due today"}
        </span>
      )}
    </li>
  );
}

function ChoreRow({
  chore,
  pending,
  onComplete,
}: {
  chore: TodayChore;
  pending: boolean;
  onComplete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-2 py-2">
      <button
        onClick={onComplete}
        disabled={pending}
        aria-label={`Mark ${chore.name} done`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-lg text-transparent active:bg-slate-50 disabled:opacity-60"
      >
        ✓
      </button>
      <span className="flex-1 truncate text-sm font-medium">{chore.name}</span>
      {chore.overdue && (
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
          Overdue
        </span>
      )}
    </li>
  );
}

const DATE_TONE: Record<TodayDate["urgency"], string> = {
  urgent: "text-red-600",
  soon: "text-amber-600",
  normal: "text-slate-400",
};

function DateRow({ date }: { date: TodayDate }) {
  return (
    <li className="flex items-center gap-2 px-3 py-2.5">
      <span className="flex-1 truncate text-sm">{date.title}</span>
      <span className={`text-xs font-medium ${DATE_TONE[date.urgency]}`}>
        {relativeDays(date.daysUntil)}
      </span>
    </li>
  );
}
