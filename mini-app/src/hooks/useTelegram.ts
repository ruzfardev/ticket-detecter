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

export function useTelegram() {
  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    if (!tg) return;
    tg.ready();
    tg.expand();

    // Light/dark + Telegram chrome (header/bg) coloring lives in useThemeSync,
    // which owns the effective theme (and the user's appearance preference).

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
