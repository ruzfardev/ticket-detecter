import { useEffect } from "react";

/**
 * Keeps the `.dark` class on <html> in sync with the active color scheme.
 *
 * Inside Telegram we follow `WebApp.colorScheme` and react to `themeChanged`
 * so switching the app theme re-skins live. Outside Telegram (browser / dev)
 * we fall back to the OS `prefers-color-scheme`. Call once at the app root.
 */
export function useThemeSync() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => root.classList.toggle("dark", dark);

    const tg = window.Telegram?.WebApp;

    if (tg) {
      const sync = () => apply(tg.colorScheme === "dark");
      sync();
      tg.onEvent?.("themeChanged", sync);
      return () => tg.offEvent?.("themeChanged", sync);
    }

    // Browser / dev fallback — follow the OS preference.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    apply(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
}
