/** 83_400 ms → "1min 23s"; 9_000 → "9s". */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return min > 0 ? `${min}min ${String(sec).padStart(2, "0")}s` : `${sec}s`;
}
