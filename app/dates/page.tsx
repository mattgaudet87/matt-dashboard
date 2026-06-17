"use client";

import { useCallback, useEffect, useState } from "react";
import { relativeDays } from "@/lib/format";
import type {
  DateRow,
  DatesResponse,
  DateUrgency,
  PeopleResponse,
} from "@/lib/types";

interface PersonOption {
  id: number;
  name: string;
}

const TYPES = ["birthday", "anniversary", "renewal", "event", "reminder"] as const;

const TYPE_EMOJI: Record<string, string> = {
  birthday: "🎂",
  anniversary: "💍",
  renewal: "🔁",
  event: "📅",
  reminder: "⏰",
};

const URGENCY_TONE: Record<DateUrgency, string> = {
  urgent: "text-coral",
  soon: "text-gold",
  normal: "text-dim",
};

export default function DatesPage() {
  const [data, setData] = useState<DatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dates", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as DatesResponse);
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

  async function dismiss(d: DateRow) {
    setPending((prev) => new Set(prev).add(d.id));
    try {
      const res = await fetch(`/api/dates/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: 0 }),
      });
      if (res.ok) await load();
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(d.id);
        return next;
      });
    }
  }

  if (loading && !data) {
    return <p className="py-12 text-center text-dim">Loading dates…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">Couldn’t load your dates.</p>
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
    <div className="animate-screen space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold">Important Dates</h1>
          <p className="text-sm text-muted">Birthdays, renewals & reminders</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          {showForm ? "Close" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <DateForm
          onSaved={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      {data.dates.length === 0 ? (
        <p className="rounded-[18px] border border-line bg-surface px-3 py-8 text-center text-sm text-dim">
          No dates yet. Add birthdays, anniversaries and renewals.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.dates.map((d) => (
            <DateCard
              key={d.id}
              date={d}
              pending={pending.has(d.id)}
              onDismiss={() => dismiss(d)}
              onSaved={load}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// --- date card -------------------------------------------------------------

function DateCard({
  date,
  pending,
  onDismiss,
  onSaved,
}: {
  date: DateRow;
  pending: boolean;
  onDismiss: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-[18px] border border-line bg-surface p-1">
        <DateForm
          initial={date}
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
    <li className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3">
      <span className="text-xl" aria-hidden>
        {TYPE_EMOJI[date.type] ?? "📅"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{date.title}</p>
          {date.isRecurring === 1 && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
              Yearly
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-dim">
          {date.eventDate} ·{" "}
          <span className={`font-medium ${URGENCY_TONE[date.urgency]}`}>
            {relativeDays(date.daysUntil)}
          </span>
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
        onClick={onDismiss}
        disabled={pending}
        className="shrink-0 px-1 py-2 text-xs font-medium text-dim active:text-muted disabled:opacity-60"
      >
        Dismiss
      </button>
    </li>
  );
}

// --- shared add / edit date form -------------------------------------------

function DateForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: DateRow;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const isEdit = initial !== undefined;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? "");
  const [type, setType] = useState<(typeof TYPES)[number]>(
    (initial?.type as (typeof TYPES)[number]) ?? "event",
  );
  const [isRecurring, setIsRecurring] = useState(initial?.isRecurring === 1);
  const [reminderOffsetDays, setReminderOffsetDays] = useState(
    String(initial?.reminderOffsetDays ?? 7),
  );
  const [personId, setPersonId] = useState<number | null>(initial?.personId ?? null);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/people", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((d: PeopleResponse) => {
        if (active) setPeople(d.people.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate) {
      setErr("Title and date are required");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const body = {
        title: title.trim(),
        eventDate,
        type,
        isRecurring: isRecurring ? 1 : 0,
        reminderOffsetDays: Number(reminderOffsetDays) || 7,
        personId,
      };
      const res = await fetch(isEdit ? `/api/dates/${initial!.id}` : "/api/dates", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "Couldn’t save date");
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save date");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[18px] border border-line bg-surface p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. Dad’s birthday)"
        className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        autoFocus
      />

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Date</span>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <div>
        <p className="mb-1 text-xs font-medium text-muted">Type</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                type === t ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {TYPE_EMOJI[t]} {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsRecurring((r) => !r)}
          aria-pressed={isRecurring}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            isRecurring ? "bg-accent text-white" : "bg-surface-2 text-muted"
          }`}
        >
          {isRecurring ? "Repeats yearly ✓" : "Repeats yearly"}
        </button>
        <label className="flex flex-1 items-center gap-2">
          <span className="text-xs font-medium text-muted">Remind (days before)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={reminderOffsetDays}
            onChange={(e) => setReminderOffsetDays(e.target.value)}
            className="w-16 rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-2 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Linked person (optional)
        </span>
        <select
          value={personId ?? ""}
          onChange={(e) => setPersonId(e.target.value ? Number(e.target.value) : null)}
          className="min-h-[44px] w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        >
          <option value="">None</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {err && <p className="text-xs text-coral">{err}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add date"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-surface-2 px-4 py-2.5 text-sm font-medium text-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
