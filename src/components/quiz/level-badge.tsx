import { cn } from "@/lib/utils";
import { LEVEL_LABELS, type Level } from "@/lib/scoring";

const STYLES: Record<Level, string> = {
  1: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  2: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  3: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  4: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const DOTS: Record<Level, string> = { 1: "🟢", 2: "🟡", 3: "🟠", 4: "🔴" };

export function LevelBadge({ level, className }: { level: Level; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", STYLES[level], className)}
    >
      <span aria-hidden>{DOTS[level]}</span>
      {LEVEL_LABELS[level]}
    </span>
  );
}
