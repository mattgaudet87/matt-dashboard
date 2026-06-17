"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "../providers";
import type { TaskRow, TasksResponse } from "@/lib/types";

const CATEGORIES = ["personal", "health", "finance", "family", "home", "chore"] as const;

const CATEGORY_TONE: Record<string, string> = {
  health: "bg-emerald/15 text-emerald",
  finance: "bg-sky/15 text-sky",
  family: "bg-coral/15 text-coral",
  home: "bg-gold/15 text-gold",
  personal: "bg-accent-2/15 text-accent-2",
  chore: "bg-surface-2 text-muted",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type Filter = "open" | "done";

export default function TasksPage() {
  const { refresh: refreshDashboard } = useDashboard();
  const [filter, setFilter] = useState<Filter>("open");
  const [data, setData] = useState<TasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (f: Filter) => {
    try {
      const res = await fetch(`/api/tasks?status=${f}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as TasksResponse);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(filter);
  }, [load, filter]);

  function setPendingId(id: number, on: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function patch(id: number, body: Record<string, unknown>) {
    setPendingId(id, true);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) await Promise.all([load(filter), refreshDashboard()]);
    } finally {
      setPendingId(id, false);
    }
  }

  if (loading && !data) {
    return <p className="py-12 text-center text-dim">Loading tasks…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">Couldn’t load your tasks.</p>
        <button
          onClick={() => load(filter)}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="animate-screen space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold">Tasks</h1>
          <p className="text-sm text-muted">Complete a task · +5 XP each</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          {showForm ? "Close" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <AddTaskForm
          onCreated={async () => {
            setShowForm(false);
            setFilter("open");
            await load("open");
          }}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["open", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
              filter === f ? "bg-accent text-white" : "bg-surface text-muted"
            }`}
          >
            {f === "open" ? "Open" : "Completed"}
          </button>
        ))}
      </div>

      {data.tasks.length === 0 ? (
        <p className="rounded-[18px] border border-line bg-surface px-3 py-8 text-center text-sm text-dim">
          {filter === "open" ? "No open tasks. 🎉" : "No completed tasks yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {data.tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              pending={pending.has(t.id)}
              onComplete={() => patch(t.id, { status: "done" })}
              onReopen={() => patch(t.id, { status: "open" })}
              onArchive={() => patch(t.id, { status: "archived" })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// --- task card -------------------------------------------------------------

function TaskCard({
  task,
  pending,
  onComplete,
  onReopen,
  onArchive,
}: {
  task: TaskRow;
  pending: boolean;
  onComplete: () => void;
  onReopen: () => void;
  onArchive: () => void;
}) {
  const done = task.status === "done";
  const overdue = !done && task.dueDate !== null && task.dueDate < todayIso();
  return (
    <li className="rounded-[18px] border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={done ? onReopen : onComplete}
          disabled={pending}
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-lg ${
            done
              ? "border-accent bg-accent text-white"
              : "border-[#3A3F58] text-transparent active:bg-surface-2"
          } disabled:opacity-60`}
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-medium ${done ? "text-dim line-through" : ""}`}>
            {task.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-dim">
            <span
              className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                CATEGORY_TONE[task.category] ?? CATEGORY_TONE.personal
              }`}
            >
              {task.category}
            </span>
            {task.priority === "high" && (
              <span className="rounded bg-gold/15 px-1.5 py-0.5 font-semibold uppercase text-gold">
                High
              </span>
            )}
            {task.dueDate && (
              <span className={overdue ? "font-medium text-coral" : ""}>
                {overdue ? "overdue · " : "due "}
                {task.dueDate}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onArchive}
          disabled={pending}
          className="shrink-0 text-xs font-medium text-dim active:text-muted disabled:opacity-60"
        >
          Archive
        </button>
      </div>
      {task.notes && <p className="mt-2 pl-14 text-xs text-muted">{task.notes}</p>}
    </li>
  );
}

// --- add task form ---------------------------------------------------------

function AddTaskForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("personal");
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          priority,
          dueDate: dueDate || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t save task");
      }
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[18px] border border-line bg-surface p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        autoFocus
      />

      <div>
        <p className="mb-1 text-xs font-medium text-muted">Category</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                category === c ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Priority</p>
          <div className="flex gap-2">
            {(["normal", "high"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                  priority === p ? "bg-accent text-white" : "bg-surface-2 text-muted"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Due (optional)</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
      />

      {err && <p className="text-xs text-coral">{err}</p>}

      <button
        type="submit"
        disabled={saving || !title.trim()}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Add task"}
      </button>
    </form>
  );
}
