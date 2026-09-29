import { useEffect } from "react";

import { useTheme } from "@/store/theme";
import { useFxStore, type FxTier } from "@/store/fx";

const AUTO_KEY = "td-fx-auto";
const STRIKES_KEY = "td-fx-strikes";

function apply(tier: FxTier) {
  document.documentElement.setAttribute("data-fx", tier);
  useFxStore.getState().setTier(tier);
}

/** Cheap up-front guess, before anything has been measured. */
function looksWeak(): boolean {
  const mem = (navigator as any).deviceMemory as number | undefined;
  return (
    (mem !== undefined && mem <= 2) ||
    (navigator.hardwareConcurrency <= 4 && /Android/.test(navigator.userAgent))
  );
}

/** Draw ~50 frames and report whether the device kept up. Median gap over
 *  26 ms (under ~38 fps) means glass is costing it; a fast display (90/120 Hz)
 *  only ever shortens gaps, so this never punishes a good phone. */
function probe(): Promise<"full" | "lite"> {
  return new Promise(resolve => {
    const gaps: number[] = [];
    let last = performance.now();
    const tick = (t: number) => {
      gaps.push(t - last);
      last = t;
      if (gaps.length < 50) return requestAnimationFrame(tick);
      const s = gaps.slice(6).sort((a, b) => a - b);
      resolve(s[Math.floor(s.length / 2)] > 26 ? "lite" : "full");
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Owns `<html data-fx>` — how much glass to draw.
 *
 * "full" and "lite" are the user's explicit choice (Settings). "auto" starts
 * from a guess, then measures once the app has settled. A single slow probe
 * proves nothing (Telegram is often still animating the sheet open), so a
 * device is only demoted after two slow launches in a row, and a good launch
 * clears the count.
 */
export function useFx() {
  const pref = useTheme(s => s.fx);

  useEffect(() => {
    if (pref === "full" || pref === "lite") { apply(pref); return; }

    const cached = localStorage.getItem(AUTO_KEY);
    apply(cached === "lite" ? "lite" : looksWeak() ? "lite" : "full");
    if (cached === "lite" || navigator.webdriver) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const verdict = await probe();
      if (cancelled) return;
      if (verdict === "full") { localStorage.setItem(STRIKES_KEY, "0"); return; }
      const strikes = Number(localStorage.getItem(STRIKES_KEY) || 0) + 1;
      localStorage.setItem(STRIKES_KEY, String(strikes));
      if (strikes >= 2) { localStorage.setItem(AUTO_KEY, "lite"); apply("lite"); }
    }, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pref]);

  // Ambient animation has no business running while the app is out of sight.
  useEffect(() => {
    const root = document.documentElement;
    const tg = window.Telegram?.WebApp;
    const set = (paused: boolean) => root.toggleAttribute("data-paused", paused);
    const onVis = () => set(document.hidden);
    const onActive = () => set(false);
    const onInactive = () => set(true);
    document.addEventListener("visibilitychange", onVis);
    tg?.onEvent?.("activated", onActive);
    tg?.onEvent?.("deactivated", onInactive);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      tg?.offEvent?.("activated", onActive);
      tg?.offEvent?.("deactivated", onInactive);
    };
  }, []);
}
