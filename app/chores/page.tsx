"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "../providers";
import type { ChoreRow, ChoresResponse } from "@/lib/types";

const FREQUENCIES = [
  { days: 1, label: "Daily" },
  { days: 7, label: "Weekly" },
  { days: 14, label: "Bi-weekly" },
  { days: 30, label: "Monthly" },
  { days: 90, label: "Quarterly" },
] as const;

function dueLabel(c: ChoreRow): string {
  if (c.overdue) return `Overdue · was due ${c.nextDueDate}`;
  if (c.dueToday) return "Due today";
  return `Next due ${c.nextDueDate}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ChoresPage() {
  const { refresh: refreshDashboard } = useDashboard();
  const [data, setData] = useState<ChoresResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/chores", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as ChoresResponse);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function setPendingId(id: number, on: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function done(c: ChoreRow) {
    setPendingId(c.id, true);
    try {
      const res = await fetch(`/api/chores/${c.id}/done`, { method: "PATCH" });
      if (res.ok) await Promise.all([load(), refreshDashboard()]);
    } finally {
      setPendingId(c.id, false);
    }
  }

  async function archive(c: ChoreRow) {
    setPendingId(c.id, true);
    try {
      const res = await fetch(`/api/chores/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: 0 }),
      });
      if (res.ok) await load();
    } finally {
      setPendingId(c.id, false);
    }
  }

  if (loading && !data) {
    return <p className="py-12 text-center text-slate-400">Loading chores…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Couldn’t load your chores.</p>
        <button
          onClick={load}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chores</h1>
          <p className="text-sm text-slate-500">Mark done · +8 XP each</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          {showForm ? "Close" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <ChoreForm
          onSaved={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      {data.chores.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-8 text-center text-sm text-slate-400">
          No chores yet. Add the recurring stuff you keep forgetting.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.chores.map((c) => (
            <ChoreCard
              key={c.id}
              chore={c}
              pending={pending.has(c.id)}
              onDone={() => done(c)}
              onArchive={() => archive(c)}
              onSaved={load}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// --- chore card ------------------------------------------------------------

function ChoreCard({
  chore,
  pending,
  onDone,
  onArchive,
  onSaved,
}: {
  chore: ChoreRow;
  pending: boolean;
  onDone: () => void;
  onArchive: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-xl bg-white p-1">
        <ChoreForm
          initial={chore}
          onSaved={async () => {
            setEditing(false);
            await onSaved();
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="rounded-xl bg-white p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onDone}
          disabled={pending}
          aria-label={`Mark ${chore.name} done`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-lg text-transparent active:bg-slate-50 disabled:opacity-60"
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{chore.name}</p>
            {chore.overdue && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                Overdue
              </span>
            )}
            {chore.dueToday && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                Due
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-xs ${chore.overdue ? "text-red-600" : "text-slate-400"}`}>
            {dueLabel(chore)} · every {chore.frequencyDays}d
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          disabled={pending}
          className="shrink-0 px-2 py-2 text-xs font-medium text-accent disabled:opacity-60"
        >
          Edit
        </button>
        <button
          onClick={onArchive}
          disabled={pending}
          className="shrink-0 px-1 py-2 text-xs font-medium text-slate-400 active:text-slate-600 disabled:opacity-60"
        >
          Archive
        </button>
      </div>
      {chore.notes && <p className="mt-2 pl-14 text-xs text-slate-500">{chore.notes}</p>}
    </li>
  );
}

// --- shared add / edit chore form ------------------------------------------

function ChoreForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: ChoreRow;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const isEdit = initial !== undefined;
  const [name, setName] = useState(initial?.name ?? "");
  const [frequencyDays, setFrequencyDays] = useState<number>(
    initial?.frequencyDays ?? 7,
  );
  const [nextDueDate, setNextDueDate] = useState(
    initial?.nextDueDate ?? todayIso(),
  );
  const [isRepeating, setIsRepeating] = useState(initial?.isRepeating !== 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const body = {
        name: name.trim(),
        frequencyDays,
        nextDueDate,
        isRepeating: isRepeating ? 1 : 0,
        notes: notes.trim() || null,
      };
      const res = await fetch(isEdit ? `/api/chores/${initial!.id}` : "/api/chores", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "Couldn’t save chore");
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save chore");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Chore name (e.g. Take out trash)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
        autoFocus
      />

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Frequency</p>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.days}
              type="button"
              onClick={() => setFrequencyDays(f.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                frequencyDays === f.days ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          {isEdit ? "Next due date" : "Start date"}
        </span>
        <input
          type="date"
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Repeats</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsRepeating(true)}
            aria-pressed={isRepeating}
            className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              isRepeating ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Yes · recurring
          </button>
          <button
            type="button"
            onClick={() => setIsRepeating(false)}
            aria-pressed={!isRepeating}
            className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              !isRepeating ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            No · one-off
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {isRepeating
            ? "Due date advances by the frequency each time it's done."
            : "Archived once done — no new due date."}
        </p>
      </div>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
      />

      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add chore"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
