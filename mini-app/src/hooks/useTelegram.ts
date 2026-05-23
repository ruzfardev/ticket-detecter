import { useEffect, useMemo } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

export type ColorScheme = "light" | "dark";
export type Platform = "ios" | "base";

// Anthropic canvas. Telegram needs the literal hex — it can't read CSS vars.
// Must mirror --canvas in index.css for light / .dark.
const CANVAS_HEX = { light: "#faf9f5", dark: "#181714" } as const;

export function useTelegram() {
  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    if (!tg) return;
    tg.ready();
    tg.expand();

    // Sync Telegram chrome (header + bg) to our canvas per color scheme, and
    // keep it in sync when the user flips their Telegram theme.
    const syncChrome = () => {
      const hex = tg.colorScheme === "dark" ? CANVAS_HEX.dark : CANVAS_HEX.light;
      try {
        tg.setHeaderColor?.(hex);
        tg.setBackgroundColor?.(hex);
      } catch {}
    };
    syncChrome();
    tg.onEvent?.("themeChanged", syncChrome);

    // Expose viewportStableHeight as a CSS var so layouts can avoid the
    // soft-keyboard zone. Keeps fixed-bottom elements above the keyboard.
    const setVh = () => {
      const h = tg.viewportStableHeight ?? tg.viewportHeight ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-vh", `${h}px`);
    };
    setVh();
    tg.onEvent?.("viewportChanged", setVh);
    window.addEventListener("resize", setVh);
    return () => {
      tg.offEvent?.("themeChanged", syncChrome);
      tg.offEvent?.("viewportChanged", setVh);
      window.removeEventListener("resize", setVh);
    };
  }, [tg]);

  return useMemo(() => {
    const platform: Platform =
      tg?.platform === "ios" || tg?.platform === "macos" ? "ios" : "base";
    const colorScheme: ColorScheme =
      tg?.colorScheme === "dark" ? "dark" : "light";

    return {
      ready: !!tg,
      initData: tg?.initData ?? "",
      user: tg?.initDataUnsafe?.user,
      colorScheme,
      platform,
      themeParams: tg?.themeParams,
      haptic: tg?.HapticFeedback,
      mainButton: tg?.MainButton,
      backButton: tg?.BackButton,
      close: () => tg?.close(),
      showAlert: (text: string) =>
        new Promise<void>(resolve =>
          tg?.showAlert ? tg.showAlert(text, () => resolve()) : (alert(text), resolve()),
        ),
      showConfirm: (text: string) =>
        new Promise<boolean>(resolve =>
          tg?.showConfirm
            ? tg.showConfirm(text, (ok: boolean) => resolve(ok))
            : resolve(confirm(text)),
        ),
      openInvoice: (link: string, cb?: (status: string) => void) =>
        tg?.openInvoice(link, cb),
      openLink: (url: string) => tg?.openLink?.(url) ?? window.open(url, "_blank"),
    };
  }, [tg]);
}
