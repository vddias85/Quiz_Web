// Nomes dos modos de jogo para as telas (página inicial, resultado, revisão).
import type { RankingFilter } from "./ranking";
import { isLevel, LEVEL_LABELS, type GameMode } from "./scoring";

export interface ModeInfo {
  mode: GameMode;
  category?: { name: string; icon: string; slug?: string } | null;
  level?: number | null;
}

/** "🎲 Temas Variados", "🌎 Geografia" ou "📶 Nível Difícil". */
export function modeLabel(info: ModeInfo): string {
  if (info.mode === "MIXED") return "🎲 Temas Variados";
  if (info.mode === "LEVEL") return `📶 Nível ${isLevel(info.level) ? LEVEL_LABELS[info.level] : ""}`.trim();
  return `${info.category?.icon ?? ""} ${info.category?.name ?? ""}`.trim();
}

/** "ranking Geral", "ranking de Geografia" ou "ranking do nível Difícil". */
export function rankingName(info: ModeInfo): string {
  if (info.mode === "MIXED") return "ranking Geral";
  if (info.mode === "LEVEL") return `ranking do nível ${isLevel(info.level) ? LEVEL_LABELS[info.level] : ""}`.trim();
  return `ranking de ${info.category?.name ?? "categoria"}`;
}

/** Filtro da página de ranking correspondente ao modo da partida. */
export function rankingFilter(info: ModeInfo): RankingFilter {
  if (info.mode === "LEVEL" && isLevel(info.level)) return { nivel: info.level };
  if (info.mode === "CATEGORY") return { categoria: info.category?.slug ?? null };
  return {};
}
