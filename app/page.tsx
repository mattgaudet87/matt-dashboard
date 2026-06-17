"use client";

import { useState } from "react";
import { useDashboard } from "./providers";
import DotGrid from "./components/DotGrid";
import {
  Badge,
  Card,
  CategoryTag,
  HabitCircle,
  SectionHeader,
  StatCard,
  categoryColor,
} from "./components/ui";
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
      // 409 (already logged) / 404 (nothing to undo) are no-op successes.
      if (res.ok || res.status === 409 || res.status === 404) await refresh();
    } finally {
      setPendingKey(key, false);
    }
  }

  if (loading && !data) {
    return <p className="py-12 text-center text-muted">Loading your day…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">Couldn’t load your dashboard.</p>
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
    <div className="animate-screen space-y-6">
      <div>
        <h1 className="text-[26px] font-bold leading-tight">
          Good {greeting.timeOfDay}, {greeting.name.split(" ")[0]}.
        </h1>
        <p className="mt-0.5 text-sm text-muted">Here’s your day at a glance.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Health Score" value={`${stats.healthScore}`} sub="of 100 this week" tone="sky" />
        <StatCard
          label="Budget Left"
          value={formatMoney(stats.budget.remaining)}
          sub="this month"
          tone={overBudget ? "coral" : "emerald"}
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
          tone={stats.relationshipsOverdue > 0 ? "coral" : "default"}
        />
      </div>

      {/* Habits */}
      <section>
        <SectionHeader title="Today’s Habits" />
        {habits.length === 0 ? (
          <Empty>No habits yet. Add some on the Grow tab.</Empty>
        ) : (
          <div className="space-y-2">
            {habits.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                pending={pending.has(`habit:${h.id}`)}
                onComplete={() => act(`habit:${h.id}`, `/api/habits/${h.id}/log`, "POST")}
                onUndo={() => act(`habit:${h.id}`, `/api/habits/${h.id}/log`, "DELETE")}
              />
            ))}
          </div>
        )}
      </section>

      {/* Tasks */}
      <section>
        <SectionHeader title="Today’s Tasks" href="/tasks" />
        {tasks.length === 0 ? (
          <Empty>Nothing due today. 🎉</Empty>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} today={data.today} />
            ))}
          </div>
        )}
      </section>

      {/* Chores */}
      <section>
        <SectionHeader title="Chores Due" href="/chores" />
        {chores.length === 0 ? (
          <Empty>No chores due today. 🎉</Empty>
        ) : (
          <div className="space-y-2">
            {chores.map((c) => (
              <ChoreRow
                key={c.id}
                chore={c}
                pending={pending.has(`chore:${c.id}`)}
                onComplete={() => act(`chore:${c.id}`, `/api/chores/${c.id}/done`, "PATCH")}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming dates */}
      <section>
        <SectionHeader title="Upcoming Dates" href="/dates" />
        {upcomingDates.length === 0 ? (
          <Empty>No dates coming up.</Empty>
        ) : (
          <Card padded={false} className="divide-y divide-line">
            {upcomingDates.map((d) => (
              <DateRow key={d.id} date={d} />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

// --- presentational pieces -------------------------------------------------

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <p className="text-center text-sm text-muted">{children}</p>
    </Card>
  );
}

function HabitRow({
  habit,
  pending,
  onComplete,
  onUndo,
}: {
  habit: TodayHabit;
  pending: boolean;
  onComplete: () => void;
  onUndo: () => void;
}) {
  const done = habit.completedToday;
  return (
    <Card className="flex items-center gap-3 !py-3">
      <HabitCircle
        done={done}
        pending={pending}
        onClick={done ? onUndo : onComplete}
        label={done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] font-medium ${done ? "text-dim line-through" : "text-ink"}`}>
          {habit.name}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <CategoryTag category={habit.category} />
          <DotGrid week={habit.week} color={categoryColor(habit.category)} />
        </div>
      </div>
      {!done && <Badge tone="xp">+10</Badge>}
    </Card>
  );
}

function TaskRow({ task, today }: { task: TodayTask; today: string }) {
  const overdue = task.dueDate !== null && task.dueDate < today;
  return (
    <Card className="flex items-center gap-2.5 !py-3">
      {task.priority === "high" && <Badge tone="high">High</Badge>}
      <span className="flex-1 truncate text-[13px] text-ink">{task.title}</span>
      {task.dueDate && (
        <span className={`text-xs font-medium ${overdue ? "text-coral" : "text-dim"}`}>
          {overdue ? "overdue" : "due today"}
        </span>
      )}
    </Card>
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
    <Card className="flex items-center gap-3 !py-3">
      <HabitCircle
        done={false}
        pending={pending}
        onClick={onComplete}
        label={`Mark ${chore.name} done`}
      />
      <span className="flex-1 truncate text-[13px] font-medium text-ink">{chore.name}</span>
      {chore.overdue && <Badge tone="overdue">Overdue</Badge>}
    </Card>
  );
}

const DATE_TONE: Record<TodayDate["urgency"], string> = {
  urgent: "text-coral",
  soon: "text-gold",
  normal: "text-dim",
};

function DateRow({ date }: { date: TodayDate }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <span className="flex-1 truncate text-[13px] text-ink">{date.title}</span>
      <span className={`text-xs font-medium ${DATE_TONE[date.urgency]}`}>
        {relativeDays(date.daysUntil)}
      </span>
    </div>
  );
}
