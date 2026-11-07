import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSoundEnabled, playSound, setSoundEnabled, SOUND_STORAGE_KEY, SOUNDS, subscribeSound } from "@/lib/sound";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe("preferência de som", () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    storage = fakeStorage();
    vi.stubGlobal("window", { localStorage: storage, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("começa DESLIGADO (PRD S11)", () => {
    expect(isSoundEnabled()).toBe(false);
  });

  it("liga e desliga, guardando no localStorage", () => {
    setSoundEnabled(true);
    expect(storage.data.get(SOUND_STORAGE_KEY)).toBe("on");
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(storage.data.has(SOUND_STORAGE_KEY)).toBe(false);
    expect(isSoundEnabled()).toBe(false);
  });

  it("avisa os inscritos quando a preferência muda", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSound(listener);
    setSoundEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setSoundEnabled(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("armazenamento bloqueado: fica desligado e não quebra", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("bloqueado");
      },
    });
    expect(isSoundEnabled()).toBe(false);
    expect(() => setSoundEnabled(true)).not.toThrow();
  });

  it("sem suporte a áudio, tocar não quebra", () => {
    setSoundEnabled(true);
    expect(() => playSound("correct")).not.toThrow();
  });

  it("no servidor (sem window) fica desligado", () => {
    vi.unstubAllGlobals();
    expect(isSoundEnabled()).toBe(false);
  });
});

describe("sons", () => {
  it("todas as notas têm frequência e duração válidas e são curtas", () => {
    for (const notes of Object.values(SOUNDS)) {
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.freq).toBeGreaterThan(0);
        expect(n.duration).toBeGreaterThan(0);
      }
      const end = Math.max(...notes.map((n) => n.start + n.duration));
      expect(end).toBeLessThanOrEqual(1);
    }
  });
});
