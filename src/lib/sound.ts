// Sons opcionais (S11): DESLIGADOS por padrão. A preferência fica no localStorage do navegador.
// Os sons são sintetizados com a Web Audio API: nenhum arquivo de áudio para baixar.

export const SOUND_STORAGE_KEY = "qw_sound";

export type SoundName = "correct" | "wrong" | "timeout" | "tick" | "finish";

export interface Note {
  freq: number; // Hz
  start: number; // s, a partir do disparo
  duration: number; // s
  type?: OscillatorType;
}

export const SOUNDS: Record<SoundName, readonly Note[]> = {
  correct: [
    { freq: 660, start: 0, duration: 0.12 },
    { freq: 880, start: 0.1, duration: 0.2 },
  ],
  wrong: [
    { freq: 300, start: 0, duration: 0.15, type: "triangle" },
    { freq: 200, start: 0.13, duration: 0.25, type: "triangle" },
  ],
  timeout: [
    { freq: 440, start: 0, duration: 0.15, type: "square" },
    { freq: 330, start: 0.18, duration: 0.15, type: "square" },
    { freq: 220, start: 0.36, duration: 0.3, type: "square" },
  ],
  tick: [{ freq: 1000, start: 0, duration: 0.04 }],
  finish: [
    { freq: 523, start: 0, duration: 0.12 },
    { freq: 659, start: 0.12, duration: 0.12 },
    { freq: 784, start: 0.24, duration: 0.12 },
    { freq: 1047, start: 0.36, duration: 0.3 },
  ],
};

const VOLUME = 0.08;

// --- Preferência -----------------------------------------------------------------------

const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // modo privado ou armazenamento bloqueado
  }
}

export function isSoundEnabled(): boolean {
  try {
    return storage()?.getItem(SOUND_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    const s = storage();
    if (on) s?.setItem(SOUND_STORAGE_KEY, "on");
    else s?.removeItem(SOUND_STORAGE_KEY);
  } catch {}
  listeners.forEach((l) => l());
  if (on) audioContext(); // o clique que liga o som também libera o áudio no navegador
}

/** Para `useSyncExternalStore`: avisa quando a preferência muda (nesta aba ou em outra). */
export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SOUND_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// --- Reprodução --------------------------------------------------------------------------

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Toca o som, se o jogador ligou os sons. Falhas de áudio nunca atrapalham o jogo. */
export function playSound(name: SoundName): void {
  if (!isSoundEnabled()) return;
  const ac = audioContext();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    for (const note of SOUNDS[name]) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = note.type ?? "sine";
      osc.frequency.value = note.freq;
      const t0 = now + note.start;
      const t1 = t0 + note.duration;
      // Envelope curto (sem estalos): sobe em 10 ms e cai até o fim da nota.
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(VOLUME, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  } catch {}
}
