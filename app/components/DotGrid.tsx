// Reusable 7-day habit dot grid. Used on Home and the Grow/Habits screen.
// Dark redesign: completed = category colour, today = transparent + accent
// border, missed/future = surface-2 (#181B26).
import type { HabitDotStatus, HabitWeekDay } from "@/lib/types";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function DotGrid({
  week,
  showLabels = false,
  size = "sm",
  color = "#7b61ff",
}: {
  week: HabitWeekDay[];
  showLabels?: boolean;
  size?: "sm" | "md";
  /** Fill colour for completed days (defaults to accent). */
  color?: string;
}) {
  const dot = size === "md" ? "h-[13px] w-[13px]" : "h-2.5 w-2.5";

  function styleFor(status: HabitDotStatus): React.CSSProperties {
    switch (status) {
      case "completed":
        return { backgroundColor: color };
      case "today":
        return { backgroundColor: "transparent", boxShadow: "inset 0 0 0 2px #7b61ff" };
      default: // missed | empty | future
        return { backgroundColor: "#181b26" };
    }
  }

  return (
    <div className="flex gap-1.5">
      {week.map((d, i) => (
        <div key={d.date} className="flex flex-col items-center gap-1">
          {showLabels && (
            <span className="text-[10px] font-medium text-dim">{DAY_LABELS[i]}</span>
          )}
          <span
            title={`${d.date}: ${d.status}`}
            className={`${dot} rounded-full`}
            style={styleFor(d.status)}
          />
        </div>
      ))}
    </div>
  );
}
