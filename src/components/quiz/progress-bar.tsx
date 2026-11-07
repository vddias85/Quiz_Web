export function ProgressBar({ position, total }: { position: number; total: number }) {
  const done = position - 1;
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label="Progresso do quiz"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-highlight transition-[width] duration-300" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="text-sm font-medium tabular-nums text-muted-foreground">
        {position}/{total}
      </span>
    </div>
  );
}
