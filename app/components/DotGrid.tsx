// Reusable 7-day habit dot grid. Used on Today and the Habits page.
import type { HabitDotStatus, HabitWeekDay } from "@/lib/types";

const DOT_CLASS: Record<HabitDotStatus, string> = {
  completed: "bg-accent",
  today: "border-2 border-accent bg-white",
  missed: "bg-slate-300",
  empty: "bg-slate-100",
  future: "bg-slate-100",
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function DotGrid({
  week,
  showLabels = false,
  size = "sm",
}: {
  week: HabitWeekDay[];
  showLabels?: boolean;
  size?: "sm" | "md";
}) {
  const dot = size === "md" ? "h-4 w-4" : "h-2.5 w-2.5";
  return (
    <div className="flex gap-1.5">
      {week.map((d, i) => (
        <div key={d.date} className="flex flex-col items-center gap-1">
          {showLabels && (
            <span className="text-[10px] font-medium text-slate-400">{DAY_LABELS[i]}</span>
          )}
          <span
            title={`${d.date}: ${d.status}`}
            className={`${dot} rounded-full ${DOT_CLASS[d.status]}`}
          />
        </div>
      ))}
    </div>
  );
}
