import { useEffect } from "react";

import { useTheme, type Palette } from "@/store/theme";

// Telegram needs literal hex — it can't read CSS vars. Mirror each
// palette's --canvas in index.css (light / .dark variants).
const CANVAS_HEX: Record<Palette, { light: string; dark: string }> = {
  eticket: { light: "#ffffff", dark: "#161722" },
  cream:   { light: "#faf9f5", dark: "#181714" },
  emerald: { light: "#f9fbf9", dark: "#111716" },
};

/**
 * Owns the app's appearance: toggles the `.dark` class on <html>, sets the
 * palette's `data-theme` attribute AND recolors the Telegram chrome
 * (header + background) to match.
 *
 * Honours the user's preference (useTheme):
 *   - mode "system": follow the Telegram client theme (or OS
 *     `prefers-color-scheme` outside Telegram), reacting live to
 *     `themeChanged`.
 *   - mode "light" / "dark": force it regardless of the client.
 *   - palette: which of the three color palettes to apply.
 * Call once at the app root.
 */
export function useThemeSync() {
  const mode = useTheme(s => s.mode);
  const palette = useTheme(s => s.palette);

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
      root.setAttribute("data-theme", palette);
      const hex = CANVAS_HEX[palette][dark ? "dark" : "light"];
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
  }, [mode, palette]);
}
