"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Tema claro/escuro (S6). Segue o sistema até o jogador escolher; a escolha fica no localStorage. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
