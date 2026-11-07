/** 83_400 ms → "1min 23s"; 9_000 → "9s". */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return min > 0 ? `${min}min ${String(sec).padStart(2, "0")}s` : `${sec}s`;
}

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Data e hora curtas no fuso de São Paulo: "07/11, 19:30". */
export function formatDateTime(date: Date | string): string {
  return DATE_TIME.format(typeof date === "string" ? new Date(date) : date);
}
