// Controle de tempo (PRD §2.1, §2.2 e §10). O servidor é a fonte da verdade.

export const QUESTION_TIME_MS = 30_000;
export const GRACE_MS = 2_000; // tolerância para a latência da internet
export const SESSION_TTL_MS = 15 * 60_000; // tempo máximo de jogo ATIVO
export const SAVED_GAME_TTL_MS = 24 * 60 * 60_000; // validade de um jogo salvo

const elapsed = (from: Date, now: Date) => now.getTime() - from.getTime();

/** A resposta chegou depois de 30 s + 2 s de tolerância? */
export function isTimedOut(shownAt: Date, now: Date): boolean {
  return elapsed(shownAt, now) > QUESTION_TIME_MS + GRACE_MS;
}

/** Tempo restante para exibir no cronômetro (sem a tolerância). */
export function remainingMs(shownAt: Date, now: Date): number {
  return Math.max(0, QUESTION_TIME_MS - elapsed(shownAt, now));
}

/** Tempo gasto na pergunta, limitado a 0–30 000 ms. */
export function answerTimeMs(shownAt: Date, now: Date): number {
  return Math.min(QUESTION_TIME_MS, Math.max(0, elapsed(shownAt, now)));
}

export interface ActiveTime {
  activeSince: Date; // início do trecho atual (início da partida ou retomada)
  activeMsBefore: number; // tempo jogado antes do último salvamento
}

/** Tempo de jogo ativo: trechos anteriores + trecho atual. O período salvo não conta. */
export function activeMs(t: ActiveTime, now: Date): number {
  return t.activeMsBefore + Math.max(0, elapsed(t.activeSince, now));
}

/** Passou de 15 minutos de jogo ativo? */
export function isSessionExpired(t: ActiveTime, now: Date): boolean {
  return activeMs(t, now) > SESSION_TTL_MS;
}

/** Jogo salvo há mais de 24 horas? */
export function isSavedGameExpired(savedAt: Date, now: Date): boolean {
  return elapsed(savedAt, now) > SAVED_GAME_TTL_MS;
}
