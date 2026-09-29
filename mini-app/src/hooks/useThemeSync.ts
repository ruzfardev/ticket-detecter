import { useEffect } from "react";

import { useTheme, type Palette } from "@/store/theme";
import { isApple } from "@/lib/platform";

// Telegram and <meta name="theme-color"> need literal hex — they can't read
// CSS vars. Mirror each palette's --canvas in styles/tokens.css (light / .dark).
const CANVAS_HEX: Record<Palette, { light: string; dark: string }> = {
  cream:   { light: "#f7f3ee", dark: "#110f0d" },
  eticket: { light: "#f1f5f9", dark: "#101119" },
  emerald: { light: "#f2f8f4", dark: "#0f1514" },
};

/** One theme-color tag, no media query: the app's own mode decides, not the OS. */
function setThemeColorMeta(hex: string) {
  const tags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  const first = tags[0] ?? document.head.appendChild(Object.assign(document.createElement("meta"), { name: "theme-color" }));
  first.removeAttribute("media");
  first.content = hex;
  tags.forEach((t, i) => { if (i > 0) t.remove(); });
}

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
 * Call once at the app root. index.html has already set the same classes
 * before first paint; this keeps them in sync afterwards.
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
      return tg?.initData ? tg.colorScheme === "dark" : mq.matches; // system
    };

    const apply = () => {
      const dark = isDark();
      root.classList.toggle("dark", dark);
      root.classList.toggle("apple", isApple());
      root.setAttribute("data-theme", palette);
      const hex = CANVAS_HEX[palette][dark ? "dark" : "light"];
      setThemeColorMeta(hex);
      try {
        tg?.setHeaderColor?.(hex);
        tg?.setBackgroundColor?.(hex);
        // Bot API 7.10+: the strip behind the bottom tab bar; without it the
        // tab zone keeps Telegram's default colour under the canvas.
        tg?.setBottomBarColor?.(hex);
      } catch {}
    };

    apply();

    // Only react to client/OS theme changes while following the system.
    if (tg?.initData) {
      const onTheme = () => { if (mode === "system") apply(); };
      tg.onEvent?.("themeChanged", onTheme);
      return () => tg.offEvent?.("themeChanged", onTheme);
    }
    const onMq = () => { if (mode === "system") apply(); };
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, [mode, palette]);
}
