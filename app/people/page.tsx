"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "../providers";
import type { PeopleResponse, PersonListItem, RelationshipUrgency } from "@/lib/types";

const RELATIONSHIP_TYPES = ["family", "friend", "partner", "mentor", "other"] as const;

// Friendly labels for the common check-in cadences.
const FREQUENCIES = [
  { days: 3, label: "Every 3 days" },
  { days: 7, label: "Weekly" },
  { days: 14, label: "Every 2 weeks" },
  { days: 30, label: "Monthly" },
  { days: 90, label: "Quarterly" },
] as const;

const URGENCY_TONE: Record<RelationshipUrgency, string> = {
  overdue: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-700",
  good: "bg-emerald-100 text-emerald-700",
};

const URGENCY_LABEL: Record<RelationshipUrgency, string> = {
  overdue: "Overdue",
  soon: "Soon",
  good: "Good",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function PeoplePage() {
  const { refresh: refreshDashboard } = useDashboard();
  const [data, setData] = useState<PeopleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [logFor, setLogFor] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/people", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as PeopleResponse);
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

  async function archive(p: PersonListItem) {
    setPendingId(p.id, true);
    try {
      const res = await fetch(`/api/people/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: 0 }),
      });
      if (res.ok) await load();
    } finally {
      setPendingId(p.id, false);
    }
  }

  if (loading && !data) {
    return <p className="py-12 text-center text-slate-400">Loading people…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Couldn’t load your people.</p>
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

  const overdueCount = data.people.filter((p) => p.urgency === "overdue").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relationships</h1>
          <p className="text-sm text-slate-500">
            {overdueCount > 0
              ? `${overdueCount} overdue · log a contact for +15 XP`
              : "Log a contact · +15 XP each"}
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          {showForm ? "Close" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <AddPersonForm
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      {data.people.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-8 text-center text-sm text-slate-400">
          No one tracked yet. Add the people who matter most.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.people.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              pending={pending.has(p.id)}
              logging={logFor === p.id}
              onToggleLog={() => setLogFor((cur) => (cur === p.id ? null : p.id))}
              onArchive={() => archive(p)}
              onLogged={async () => {
                setLogFor(null);
                await Promise.all([load(), refreshDashboard()]);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// --- person card -----------------------------------------------------------

function lastContactLabel(p: PersonListItem): string {
  if (p.daysSinceContact === null) return "No contact logged yet";
  if (p.daysSinceContact === 0) return "Last contact: today";
  if (p.daysSinceContact === 1) return "Last contact: yesterday";
  return `Last contact: ${p.daysSinceContact} days ago`;
}

function PersonCard({
  person,
  pending,
  logging,
  onToggleLog,
  onArchive,
  onLogged,
}: {
  person: PersonListItem;
  pending: boolean;
  logging: boolean;
  onToggleLog: () => void;
  onArchive: () => void;
  onLogged: () => void;
}) {
  return (
    <li className="rounded-xl bg-white p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{person.name}</p>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${URGENCY_TONE[person.urgency]}`}
            >
              {URGENCY_LABEL[person.urgency]}
            </span>
          </div>
          <p className="mt-0.5 text-xs capitalize text-slate-400">
            {person.relationshipType} · {lastContactLabel(person)}
          </p>
        </div>
        <button
          onClick={onArchive}
          disabled={pending}
          className="shrink-0 text-xs font-medium text-slate-400 active:text-slate-600 disabled:opacity-60"
        >
          Archive
        </button>
      </div>

      {person.notes && (
        <p className="mt-2 text-xs text-slate-500">{person.notes}</p>
      )}

      <div className="mt-3">
        {logging ? (
          <LogContactForm personId={person.id} onLogged={onLogged} onCancel={onToggleLog} />
        ) : (
          <button
            onClick={onToggleLog}
            className="w-full rounded-lg bg-accent/10 py-2 text-sm font-semibold text-accent active:bg-accent/20"
          >
            Log contact · +15 XP
          </button>
        )}
      </div>
    </li>
  );
}

// --- log contact form ------------------------------------------------------

function LogContactForm({
  personId,
  onLogged,
  onCancel,
}: {
  personId: number;
  onLogged: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/people/${personId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactDate: date, note: note.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t log contact");
      }
      onLogged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t log contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg bg-slate-50 p-3">
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
          autoFocus
        />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save contact"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- add person form -------------------------------------------------------

function AddPersonForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [relationshipType, setRelationshipType] =
    useState<(typeof RELATIONSHIP_TYPES)[number]>("friend");
  const [frequency, setFrequency] = useState<number>(7);
  const [birthday, setBirthday] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relationshipType,
          checkinFrequencyDays: frequency,
          notes: notes.trim() || null,
          birthday: birthday || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t save person");
      }
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save person");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
        autoFocus
      />

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Relationship</p>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIP_TYPES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRelationshipType(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                relationshipType === r ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Check in</p>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.days}
              type="button"
              onClick={() => setFrequency(f.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                frequency === f.days ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Birthday (optional — adds a recurring date)
        </span>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
      />

      {err && <p className="text-xs text-red-600">{err}</p>}

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Add person"}
      </button>
    </form>
  );
}
