// Regras puras do ranking (PRD §7 e §8.7): períodos no fuso de São Paulo e filtros.
// A consulta ao banco fica em src/server/ranking.ts.

export const RANKING_TIME_ZONE = "America/Sao_Paulo";
export const RANKING_TOP = 50;

export const PERIODS = ["today", "week", "month", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  week: "Semana",
  month: "Mês",
  all: "Sempre",
};

/** Escopo do ranking: Geral (modo Temas Variados) ou uma categoria. */
export type RankingScope = { mode: "MIXED" } | { mode: "CATEGORY"; categoryId: number };

const WEEKDAYS: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** Data local (ano, mês, dia, dia da semana) e o deslocamento em ms do fuso naquele instante. */
function zonedParts(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      timeZoneName: "longOffset",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  // "GMT-03:00" → -3 h; "GMT" → 0
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(parts.timeZoneName ?? "");
  const offsetMs = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000 : 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekdayFromMonday: WEEKDAYS[parts.weekday] ?? 0,
    offsetMs,
  };
}

/** Meia-noite local de (ano, mês, dia) no fuso, como instante UTC. */
function localMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  // O deslocamento é o da própria meia-noite (relevante só em fusos com horário de verão).
  const { offsetMs } = zonedParts(new Date(guess), timeZone);
  return new Date(guess - offsetMs);
}

/**
 * Início do período no fuso do ranking. Hoje = dia corrente; Semana = desde segunda-feira;
 * Mês = desde o dia 1; Sempre = sem limite (null).
 */
export function periodStart(period: Period, now: Date, timeZone = RANKING_TIME_ZONE): Date | null {
  if (period === "all") return null;
  const { year, month, day, weekdayFromMonday } = zonedParts(now, timeZone);
  if (period === "today") return localMidnight(year, month, day, timeZone);
  if (period === "month") return localMidnight(year, month, 1, timeZone);
  // Semana: volta até a segunda-feira (Date.UTC normaliza dias negativos para o mês anterior).
  const monday = new Date(Date.UTC(year, month - 1, day - weekdayFromMonday));
  return localMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), timeZone);
}

export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value);
}

// Parâmetros em português usados nas URLs das páginas (/ranking?periodo=semana).
export const PERIOD_SLUGS: Record<Period, string> = {
  today: "hoje",
  week: "semana",
  month: "mes",
  all: "sempre",
};

export function periodFromSlug(slug: string | undefined): Period {
  const found = PERIODS.find((p) => PERIOD_SLUGS[p] === slug);
  return found ?? "all";
}

/** URL da página de ranking: /ranking?categoria=geografia&periodo=semana (sem categoria = Geral). */
export function rankingHref(categorySlug: string | null, period: Period = "all"): string {
  const params = new URLSearchParams();
  if (categorySlug) params.set("categoria", categorySlug);
  if (period !== "all") params.set("periodo", PERIOD_SLUGS[period]);
  const qs = params.toString();
  return qs ? `/ranking?${qs}` : "/ranking";
}
