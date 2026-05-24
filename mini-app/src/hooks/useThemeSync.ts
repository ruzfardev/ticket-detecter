import { useEffect } from "react";

import { useTheme } from "@/store/theme";

// Telegram needs the literal hex — it can't read CSS vars. Mirror --canvas
// in index.css (light / .dark).
const CANVAS_HEX = { light: "#faf9f5", dark: "#181714" } as const;

/**
 * Owns the app's effective light/dark: toggles the `.dark` class on <html>
 * AND recolors the Telegram chrome (header + background) to match.
 *
 * Honours the user's preference (useTheme):
 *   - "system": follow the Telegram client theme (or OS `prefers-color-scheme`
 *     outside Telegram), reacting live to `themeChanged`.
 *   - "light" / "dark": force it regardless of the client.
 * Call once at the app root.
 */
export function useThemeSync() {
  const mode = useTheme(s => s.mode);

  useEffect(() => {
    const root = document.documentElement;
    const tg = window.Telegram?.WebApp;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const isDark = () => {
      if (mode === "dark") return true;
      if (mode === "light") return false;
      return tg ? tg.colorScheme === "dark" : mq.matches; // system
    };

    const apply = () => {
      const dark = isDark();
      root.classList.toggle("dark", dark);
      const hex = dark ? CANVAS_HEX.dark : CANVAS_HEX.light;
      try {
        tg?.setHeaderColor?.(hex);
        tg?.setBackgroundColor?.(hex);
      } catch {}
    };

    apply();

    // Only react to client/OS theme changes while following the system.
    if (tg) {
      const onTheme = () => { if (mode === "system") apply(); };
      tg.onEvent?.("themeChanged", onTheme);
      return () => tg.offEvent?.("themeChanged", onTheme);
    }
    const onMq = () => { if (mode === "system") apply(); };
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, [mode]);
}
