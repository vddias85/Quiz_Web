// Validação e normalização de apelidos (PRD §10 e §8.7).
import { BLOCKED_SUBSTRINGS, BLOCKED_TOKENS } from "./profanity-pt";

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;

// Letras (com acento), números, _ e -.
const NICKNAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9_-]+$/;

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", "$": "s",
};

const COMBINING_MARKS = /[̀-ͯ]/g;
const REPEATED_CHAR = /(.)\1+/g;

const stripAccents = (s: string) => s.normalize("NFD").replace(COMBINING_MARKS, "");

/** Chave de unicidade: minúsculas e sem acento ("João" e "joao" são o mesmo apelido). */
export function nicknameKey(nickname: string): string {
  return stripAccents(nickname.trim()).toLowerCase();
}

/**
 * Formas usadas só pelo filtro: minúsculas, sem acento e com letras repetidas reduzidas.
 * Uma troca números por letras (leetspeak: "p0rr4" → "pora"); a outra descarta os números
 * ("porra123" → "pora"), para que números no fim não escondam a palavra.
 */
function profanityForms(s: string): string[] {
  const base = stripAccents(s).toLowerCase();
  const collapse = (t: string) => t.replace(REPEATED_CHAR, "$1");
  return [collapse(base.replace(/[0-9@$]/g, (c) => LEET[c] ?? c)), collapse(base.replace(/[0-9]/g, ""))];
}

function formIsBlocked(form: string): boolean {
  const tokens = form.split(/[_-]+/).filter(Boolean);
  const joined = tokens.join("");
  if (BLOCKED_SUBSTRINGS.some((w) => joined.includes(w))) return true;
  return [joined, ...tokens].some((t) => BLOCKED_TOKENS.includes(t));
}

export function containsProfanity(nickname: string): boolean {
  return profanityForms(nickname).some(formIsBlocked);
}

export type NicknameResult =
  | { ok: true; nickname: string; key: string }
  | { ok: false; error: string };

export function validateNickname(input: unknown): NicknameResult {
  if (typeof input !== "string") return { ok: false, error: "Informe um apelido." };
  const nickname = input.trim();
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return { ok: false, error: `O apelido deve ter de ${NICKNAME_MIN} a ${NICKNAME_MAX} caracteres.` };
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return { ok: false, error: "Use apenas letras, números, _ e -." };
  }
  if (containsProfanity(nickname)) {
    return { ok: false, error: "Esse apelido não é permitido. Escolha outro." };
  }
  return { ok: true, nickname, key: nicknameKey(nickname) };
}
