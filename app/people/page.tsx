"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "../providers";
import { todayIso } from "@/lib/format";
import type {
  ContactLogRow,
  ContactLogsResponse,
  PeopleResponse,
  PersonListItem,
  RelationshipUrgency,
} from "@/lib/types";

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
  overdue: "bg-coral/15 text-coral",
  soon: "bg-gold/15 text-gold",
  good: "bg-emerald/15 text-emerald",
};

const URGENCY_LABEL: Record<RelationshipUrgency, string> = {
  overdue: "Overdue",
  soon: "Soon",
  good: "Good",
};

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
    return <p className="py-12 text-center text-dim">Loading people…</p>;
  }
  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">Couldn’t load your people.</p>
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
    <div className="animate-screen space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold">Relationships</h1>
          <p className="text-sm text-muted">
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
        <p className="rounded-[18px] border border-line bg-surface px-3 py-8 text-center text-sm text-dim">
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
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  // Bumped to force the history list to reload after a log is added/edited/deleted.
  const [historyKey, setHistoryKey] = useState(0);

  function handleLogged() {
    setHistoryKey((k) => k + 1);
    onLogged();
  }

  if (editing) {
    return (
      <li className="rounded-[18px] border border-line bg-surface p-1">
        <PersonDetailForm
          person={person}
          onSaved={() => {
            setEditing(false);
            onLogged();
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li
      className="rounded-[18px] border bg-surface p-3"
      style={{
        borderColor: person.urgency === "overdue" ? "rgba(255,82,84,.22)" : "#1c1f2e",
      }}
    >
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
          <p className="mt-0.5 text-xs capitalize text-dim">
            {person.relationshipType} · {lastContactLabel(person)}
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          disabled={pending}
          className="shrink-0 px-2 py-2 text-xs font-medium text-accent disabled:opacity-60"
        >
          Edit / Details
        </button>
        <button
          onClick={onArchive}
          disabled={pending}
          className="shrink-0 px-1 py-2 text-xs font-medium text-dim active:text-muted disabled:opacity-60"
        >
          Archive
        </button>
      </div>

      {person.notes && (
        <p className="mt-2 text-xs text-muted">{person.notes}</p>
      )}

      {(person.whenMet || person.howMet || person.sharedInterests) && (
        <dl className="mt-2 space-y-1 border-t border-line pt-2 text-xs">
          {person.whenMet && (
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-dim">When met</dt>
              <dd className="text-muted">{person.whenMet}</dd>
            </div>
          )}
          {person.howMet && (
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-dim">How met</dt>
              <dd className="text-muted">{person.howMet}</dd>
            </div>
          )}
          {person.sharedInterests && (
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-dim">Shared</dt>
              <dd className="text-muted">{person.sharedInterests}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-3">
        {logging ? (
          <LogContactForm personId={person.id} onLogged={handleLogged} onCancel={onToggleLog} />
        ) : (
          <button
            onClick={onToggleLog}
            className={`w-full rounded-lg py-2 text-sm font-semibold ${
              person.urgency === "overdue"
                ? "bg-coral/15 text-coral active:bg-coral/25"
                : "bg-accent/10 text-accent active:bg-accent/20"
            }`}
          >
            Log contact · +15 XP
          </button>
        )}
      </div>

      <button
        onClick={() => setShowHistory((s) => !s)}
        className="mt-2 flex min-h-[44px] w-full items-center justify-center text-xs font-medium text-dim active:text-muted"
      >
        {showHistory ? "Hide history ▲" : "Contact history ▼"}
      </button>

      {showHistory && (
        <ContactHistory
          personId={person.id}
          refreshKey={historyKey}
          onChanged={handleLogged}
        />
      )}
    </li>
  );
}

// --- contact history (edit / delete) --------------------------------------

function ContactHistory({
  personId,
  refreshKey,
  onChanged,
}: {
  personId: number;
  refreshKey: number;
  onChanged: () => void;
}) {
  const [logs, setLogs] = useState<ContactLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/people/${personId}/contact`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setLogs(((await res.json()) as ContactLogsResponse).logs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t load history");
    }
  }, [personId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, refreshKey]);

  if (error) {
    return (
      <div className="mt-2 rounded-lg bg-surface-2 p-3 text-center">
        <p className="text-xs text-coral">{error}</p>
        <button onClick={load} className="mt-2 text-xs font-medium text-accent">
          Try again
        </button>
      </div>
    );
  }
  if (logs === null) {
    return <p className="mt-2 py-3 text-center text-xs text-dim">Loading history…</p>;
  }
  if (logs.length === 0) {
    return (
      <p className="mt-2 rounded-lg bg-surface-2 py-4 text-center text-xs text-dim">
        No contacts logged yet.
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-2">
      {logs.map((log) => (
        <ContactLogItem
          key={log.id}
          personId={personId}
          log={log}
          onChanged={() => {
            load();
            onChanged();
          }}
        />
      ))}
    </ul>
  );
}

function ContactLogItem({
  personId,
  log,
  onChanged,
}: {
  personId: number;
  log: ContactLogRow;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(log.contactDate);
  const [note, setNote] = useState(log.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/people/${personId}/contact/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactDate: date, note: note.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t save");
      }
      setEditing(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this contact log? This removes 15 XP.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/people/${personId}/contact/${log.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t delete");
      }
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t delete");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={save} className="space-y-2 rounded-lg bg-surface-2 p-3">
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-2 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          {err && <p className="text-xs text-coral">{err}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted">{log.contactDate}</p>
        {log.note && <p className="truncate text-xs text-muted">{log.note}</p>}
        {err && <p className="text-xs text-coral">{err}</p>}
      </div>
      <button
        onClick={() => setEditing(true)}
        disabled={busy}
        className="shrink-0 px-2 py-2 text-xs font-medium text-accent disabled:opacity-60"
      >
        Edit
      </button>
      <button
        onClick={remove}
        disabled={busy}
        className="shrink-0 px-2 py-2 text-xs font-medium text-coral disabled:opacity-60"
      >
        Delete
      </button>
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
    <form onSubmit={submit} className="space-y-2 rounded-lg bg-surface-2 p-3">
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-2 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2 text-sm outline-none focus:border-accent"
          autoFocus
        />
      </div>
      {err && <p className="text-xs text-coral">{err}</p>}
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
          className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- relationship detail form ----------------------------------------------

function PersonDetailForm({
  person,
  onSaved,
  onCancel,
}: {
  person: PersonListItem;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [relationshipType, setRelationshipType] = useState<
    (typeof RELATIONSHIP_TYPES)[number]
  >((person.relationshipType as (typeof RELATIONSHIP_TYPES)[number]) ?? "friend");
  const [frequency, setFrequency] = useState<number>(person.checkinFrequencyDays);
  const [birthday, setBirthday] = useState(person.birthday ?? "");
  const [notes, setNotes] = useState(person.notes ?? "");
  const [whenMet, setWhenMet] = useState(person.whenMet ?? "");
  const [howMet, setHowMet] = useState(person.howMet ?? "");
  const [sharedInterests, setSharedInterests] = useState(person.sharedInterests ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relationshipType,
          checkinFrequencyDays: frequency,
          birthday: birthday || null,
          notes: notes.trim() || null,
          whenMet: whenMet.trim() || null,
          howMet: howMet.trim() || null,
          sharedInterests: sharedInterests.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn’t save");
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[18px] border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink">Relationship details</p>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <div>
        <p className="mb-1 text-xs font-medium text-muted">Relationship</p>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIP_TYPES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRelationshipType(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                relationshipType === r ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted">Check in</p>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.days}
              type="button"
              onClick={() => setFrequency(f.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                frequency === f.days ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Birthday</span>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Notes</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">When met</span>
        <input
          value={whenMet}
          onChange={(e) => setWhenMet(e.target.value)}
          placeholder="e.g. Summer 2019 at a Wolf Creative event"
          className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">How met</span>
        <input
          value={howMet}
          onChange={(e) => setHowMet(e.target.value)}
          placeholder="e.g. Mutual friend introduced us"
          className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Shared interests
        </span>
        <input
          value={sharedInterests}
          onChange={(e) => setSharedInterests(e.target.value)}
          placeholder="e.g. Hockey, content creation, travel"
          className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      {err && <p className="text-xs text-coral">{err}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save details"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-surface-2 px-4 py-2.5 text-sm font-medium text-muted"
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
    <form onSubmit={submit} className="space-y-3 rounded-[18px] border border-line bg-surface p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        autoFocus
      />

      <div>
        <p className="mb-1 text-xs font-medium text-muted">Relationship</p>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIP_TYPES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRelationshipType(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                relationshipType === r ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted">Check in</p>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.days}
              type="button"
              onClick={() => setFrequency(f.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                frequency === f.days ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Birthday (optional — adds a recurring date)
        </span>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded-lg border border-line bg-surface-2 text-ink placeholder:text-dim px-3 py-2.5 text-sm outline-none focus:border-accent"
      />

      {err && <p className="text-xs text-coral">{err}</p>}

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
