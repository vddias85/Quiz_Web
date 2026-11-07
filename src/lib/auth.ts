// Cookie do jogador (PRD §8.7): guarda os ids dos apelidos que este navegador criou,
// assinado com HMAC-SHA256. Sem o cookie, ninguém joga com um apelido que já existe.
import { createHmac, timingSafeEqual } from "node:crypto";

export const PLAYER_COOKIE = "qw_player";
export const PLAYER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano
export const MAX_PLAYERS_PER_BROWSER = 10;

const ID_PATTERN = /^[a-z0-9]{10,40}$/; // cuid

function getSecret(secret = process.env.SESSION_SECRET): string {
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres).");
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodePlayerCookie(playerIds: readonly string[], secret?: string): string {
  const ids = [...new Set(playerIds)].slice(0, MAX_PLAYERS_PER_BROWSER);
  const payload = ids.join(",");
  return `${payload}.${sign(payload, getSecret(secret))}`;
}

/** Retorna os ids do cookie, ou [] se ele estiver ausente, malformado ou adulterado. */
export function decodePlayerCookie(value: string | undefined, secret?: string): string[] {
  if (!value) return [];
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return [];
  const payload = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(payload, getSecret(secret)));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return [];
  const ids = payload.split(",");
  return ids.every((id) => ID_PATTERN.test(id)) ? ids.slice(0, MAX_PLAYERS_PER_BROWSER) : [];
}

/** Coloca o jogador atual na frente da lista (o mais recente primeiro). */
export function withPlayer(playerIds: readonly string[], playerId: string): string[] {
  return [playerId, ...playerIds.filter((id) => id !== playerId)].slice(0, MAX_PLAYERS_PER_BROWSER);
}
