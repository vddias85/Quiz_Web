// Auxiliares das rotas da API: erros padronizados, cookie do jogador, IP e limite de requisições.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { decodePlayerCookie, encodePlayerCookie, PLAYER_COOKIE, PLAYER_COOKIE_MAX_AGE } from "@/lib/auth";
import { consumeRateLimit, type RateLimitRule } from "@/lib/rate-limit";
import { ApiError } from "./errors";

export const SESSION_ID_PATTERN = /^[a-z0-9]{20,32}$/;

/** Executa a rota e converte erros em JSON `{ error: { code, message } }`. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    console.error("[api] erro inesperado:", err);
    return NextResponse.json(
      { error: { code: "internal", message: "Algo deu errado. Tente novamente em instantes." } },
      { status: 500 },
    );
  }
}

export function json<T>(data: T, init?: ResponseInit): Response {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

export async function readOwnedPlayerIds(): Promise<string[]> {
  const store = await cookies();
  return decodePlayerCookie(store.get(PLAYER_COOKIE)?.value);
}

export async function writeOwnedPlayerIds(ids: readonly string[]): Promise<void> {
  const store = await cookies();
  store.set(PLAYER_COOKIE, encodePlayerCookie(ids), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PLAYER_COOKIE_MAX_AGE,
  });
}

/** IP do cliente. Na Vercel, o primeiro valor de x-forwarded-for é o do usuário. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

export async function enforceRateLimit(req: Request, route: string, rule: RateLimitRule): Promise<void> {
  const allowed = await consumeRateLimit(`${route}:${clientIp(req)}`, rule);
  if (!allowed) {
    throw new ApiError(429, "rate_limited", "Muitas requisições. Aguarde um pouco e tente de novo.");
  }
}

/** Lê o corpo JSON e valida com Zod. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_body", "Requisição inválida.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "invalid_body", "Requisição inválida.");
  return parsed.data;
}

export async function sessionIdFrom(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!SESSION_ID_PATTERN.test(id)) throw new ApiError(404, "not_found", "Sessão não encontrada.");
  return id;
}
