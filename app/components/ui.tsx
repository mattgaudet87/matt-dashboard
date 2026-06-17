// Shared dark-theme UI primitives for the redesign. Reused across all screens.
import Link from "next/link";

// ── Card ──────────────────────────────────────────────────────────
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] border border-line bg-surface ${padded ? "p-4" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

// ── Stat card (label / hero number / sub) ─────────────────────────
const STAT_TONE = {
  default: "text-ink",
  accent: "text-accent",
  coral: "text-coral",
  emerald: "text-emerald",
  gold: "text-gold",
  sky: "text-sky",
} as const;

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: keyof typeof STAT_TONE;
}) {
  return (
    <Card>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${STAT_TONE[tone]}`}>{value}</p>
      <p className="mt-0.5 text-xs text-dim">{sub}</p>
    </Card>
  );
}

// ── Badge (status) ────────────────────────────────────────────────
const BADGE_TONE = {
  high: "bg-gold/15 text-gold",
  overdue: "bg-coral/15 text-coral",
  good: "bg-emerald/15 text-emerald",
  soon: "bg-gold/15 text-gold",
  xp: "bg-accent/15 text-accent",
  neutral: "bg-surface-2 text-muted",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONE;
  className?: string;
}) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BADGE_TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ── Category tag (habit category → colour) ────────────────────────
const CATEGORY_TONE: Record<string, string> = {
  health: "bg-sky/15 text-sky",
  mindset: "bg-accent-2/15 text-accent-2",
  relationships: "bg-emerald/15 text-emerald",
  fitness: "bg-fire/15 text-fire",
  other: "bg-surface-2 text-muted",
};

// Display label tweaks (relationships → RELS to match the mockup).
const CATEGORY_LABEL: Record<string, string> = {
  relationships: "RELS",
};

export function categoryColor(category: string): string {
  const map: Record<string, string> = {
    health: "#5bb8ff",
    mindset: "#a78bfa",
    relationships: "#2dd4a0",
    fitness: "#ff6b35",
    other: "#7a80a0",
  };
  return map[category] ?? map.other;
}

export function CategoryTag({ category }: { category: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        CATEGORY_TONE[category] ?? CATEGORY_TONE.other
      }`}
    >
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}

// ── Habit circle (tap to complete, animated) ──────────────────────
export function HabitCircle({
  done,
  pending,
  onClick,
  label,
}: {
  done: boolean;
  pending: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-lg transition-colors disabled:opacity-60 ${
        done
          ? "animate-habit-pop border-emerald bg-emerald text-white"
          : "border-[#3A3F58] text-transparent active:bg-surface-2"
      }`}
    >
      ✓
    </button>
  );
}

// ── Section header ────────────────────────────────────────────────
export function SectionHeader({
  title,
  href,
  action,
}: {
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-0.5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {href && (
        <Link href={href} className="text-xs font-semibold text-accent">
          {action ?? "View all →"}
        </Link>
      )}
    </div>
  );
}
