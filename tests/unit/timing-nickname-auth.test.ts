import { describe, expect, it } from "vitest";
import {
  activeMs,
  answerTimeMs,
  isSavedGameExpired,
  isSessionExpired,
  isTimedOut,
  remainingMs,
} from "@/lib/timing";
import { containsProfanity, nicknameKey, validateNickname } from "@/lib/nickname";
import { decodePlayerCookie, encodePlayerCookie, withPlayer } from "@/lib/auth";

const t0 = new Date("2026-11-07T12:00:00.000Z");
const after = (ms: number) => new Date(t0.getTime() + ms);

describe("timing", () => {
  it("aceita até 32 s (30 s + 2 s de tolerância)", () => {
    expect(isTimedOut(t0, after(29_999))).toBe(false);
    expect(isTimedOut(t0, after(32_000))).toBe(false);
    expect(isTimedOut(t0, after(32_001))).toBe(true);
    expect(isTimedOut(t0, after(33_000))).toBe(true);
  });
  it("tempo restante não fica negativo", () => {
    expect(remainingMs(t0, after(10_000))).toBe(20_000);
    expect(remainingMs(t0, after(45_000))).toBe(0);
  });
  it("tempo gasto fica entre 0 e 30 000 ms", () => {
    expect(answerTimeMs(t0, after(12_345))).toBe(12_345);
    expect(answerTimeMs(t0, after(31_500))).toBe(30_000);
    expect(answerTimeMs(t0, after(-50))).toBe(0);
  });
  it("sessão expira depois de 15 minutos de jogo ativo", () => {
    const fresh = { activeSince: t0, activeMsBefore: 0 };
    expect(isSessionExpired(fresh, after(15 * 60_000))).toBe(false);
    expect(isSessionExpired(fresh, after(15 * 60_000 + 1))).toBe(true);
  });
  it("o tempo em que o jogo ficou salvo não conta", () => {
    // Jogou 10 min, salvou; retomou em t0 e jogou mais 4 min → 14 min ativos.
    const resumed = { activeSince: t0, activeMsBefore: 10 * 60_000 };
    expect(activeMs(resumed, after(4 * 60_000))).toBe(14 * 60_000);
    expect(isSessionExpired(resumed, after(5 * 60_000))).toBe(false);
    expect(isSessionExpired(resumed, after(5 * 60_000 + 1))).toBe(true);
  });
  it("jogo salvo vale por 24 horas", () => {
    expect(isSavedGameExpired(t0, after(24 * 60 * 60_000))).toBe(false);
    expect(isSavedGameExpired(t0, after(24 * 60 * 60_000 + 1))).toBe(true);
  });
});

describe("apelido", () => {
  it.each(["Ana", "joão_silva", "Zé-123", "a".repeat(20), "Computador", "temporada", "corporação", "Assis"])(
    "aceita %s",
    (n) => expect(validateNickname(n).ok).toBe(true),
  );

  it.each([
    ["ab", "curto"],
    ["a".repeat(21), "longo"],
    ["com espaço", "espaço"],
    ["emoji😀", "emoji"],
    ["<script>", "símbolos"],
  ])("rejeita %s (%s)", (n) => expect(validateNickname(n).ok).toBe(false));

  it("rejeita valores que não são texto", () => {
    expect(validateNickname(undefined).ok).toBe(false);
    expect(validateNickname(123).ok).toBe(false);
  });

  it.each(["porra", "PoRrA", "p0rr4", "porraaaa", "porra123", "merda_total", "Caralho", "FDP", "x-puta-x", "fuuuck", "m3rd4"])(
    "filtra palavrão: %s",
    (n) => expect(containsProfanity(n)).toBe(true),
  );

  it("chave ignora maiúsculas e acentos", () => {
    expect(nicknameKey("JOÃO")).toBe("joao");
    expect(nicknameKey(" João ")).toBe(nicknameKey("joao"));
    const v = validateNickname("  Éder ");
    expect(v).toEqual({ ok: true, nickname: "Éder", key: "eder" });
  });
});

describe("cookie do jogador", () => {
  const secret = "s".repeat(48);
  const ids = ["cmabc1234567890xyz", "cmdef1234567890xyz"];

  it("ida e volta preserva os ids", () => {
    expect(decodePlayerCookie(encodePlayerCookie(ids, secret), secret)).toEqual(ids);
  });
  it("assinatura adulterada → nenhum jogador", () => {
    const cookie = encodePlayerCookie(ids, secret);
    const forged = cookie.replace(ids[0], "cmhacker1234567890x");
    expect(decodePlayerCookie(forged, secret)).toEqual([]);
    expect(decodePlayerCookie(cookie.slice(0, -2) + "xx", secret)).toEqual([]);
  });
  it("outro segredo → nenhum jogador", () => {
    expect(decodePlayerCookie(encodePlayerCookie(ids, secret), "t".repeat(48))).toEqual([]);
  });
  it("valores malformados → nenhum jogador", () => {
    for (const v of [undefined, "", ".", "abc", "a.b.c"]) expect(decodePlayerCookie(v, secret)).toEqual([]);
  });
  it("exige segredo de pelo menos 32 caracteres", () => {
    expect(() => encodePlayerCookie(ids, "curto")).toThrow();
  });
  it("withPlayer põe o atual na frente, sem duplicar, até 10", () => {
    expect(withPlayer(ids, ids[1])).toEqual([ids[1], ids[0]]);
    const many = Array.from({ length: 10 }, (_, i) => `cmplayer${String(i).padStart(10, "0")}`);
    expect(withPlayer(many, "cmnewplayer00000000")).toHaveLength(10);
    expect(withPlayer(many, "cmnewplayer00000000")[0]).toBe("cmnewplayer00000000");
  });
});
