"use client";

import { Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { isSoundEnabled, setSoundEnabled, subscribeSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

const iconButton = cn(
  "inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors",
  "hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
);

// No servidor não se sabe o tema nem a preferência de som: os botões só ganham rótulo após hidratar.
const subscribeNothing = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const dark = hydrated && resolvedTheme === "dark";
  return (
    <button
      type="button"
      className={iconButton}
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
      data-testid="theme-toggle"
    >
      {dark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}

export function SoundToggle() {
  const enabled = useSyncExternalStore(subscribeSound, isSoundEnabled, () => false);
  return (
    <button
      type="button"
      className={iconButton}
      onClick={() => setSoundEnabled(!enabled)}
      aria-pressed={enabled}
      aria-label="Sons"
      title={enabled ? "Sons ligados" : "Sons desligados"}
      data-testid="sound-toggle"
    >
      {enabled ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
    </button>
  );
}

/** Botões de tema e som, no canto superior direito de todas as páginas. */
export function SettingsBar() {
  return (
    <div className="flex items-center gap-1">
      <SoundToggle />
      <ThemeToggle />
    </div>
  );
}
