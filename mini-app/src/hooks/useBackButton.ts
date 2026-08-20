import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTelegram } from "./useTelegram";

/**
 * In-app navigations made since this WebView opened.
 *
 * Telegram opens a fresh WebView for every `web_app` button, and the SPA
 * fallback serves the app directly at the deep-linked path — so a user arriving
 * from the bot's "enter your SMS code" button starts with a single history
 * entry. `navigate(-1)` is `history.go(-1)`, which in that situation does
 * nothing at all and leaves them stranded on the screen they were sent to.
 *
 * Module-level so the Telegram back button and individual screens agree on
 * whether there is anything to pop.
 */
let navDepth = 0;

/** How many in-app navigations deep we are. Used to unwind a finished wizard. */
export function getNavDepth(): number {
  return navDepth;
}

/** Drop `n` entries from our depth accounting after an external history jump. */
export function releaseNavDepth(n: number): void {
  navDepth = Math.max(0, navDepth - n);
}

/** Where to land when there is nowhere to go back to. */
function fallbackFor(pathname: string): string {
  if (pathname.startsWith("/order")) return "/orders";
  if (pathname.startsWith("/sub/")) return "/home";
  if (pathname.startsWith("/new")) return "/home";
  if (pathname.startsWith("/donate")) return "/premium";
  if (pathname.startsWith("/cards") || pathname.startsWith("/friends")) {
    return "/settings";
  }
  if (pathname.startsWith("/railway-link")) return "/settings";
  return "/home";
}

/**
 * Go back one step, or to a sensible parent when the user was deep-linked
 * straight here and there is no history behind them.
 */
export function useSmartBack() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (navDepth > 0) {
      navDepth -= 1;
      navigate(-1);
    } else {
      navigate(fallbackFor(location.pathname), { replace: true });
    }
  }, [navigate, location.pathname]);
}

export function useBackButton(visible: boolean) {
  const { backButton } = useTelegram();
  const goBack = useSmartBack();
  const location = useLocation();

  const lastKey = useRef(location.key);
  useEffect(() => {
    if (location.key !== lastKey.current) {
      lastKey.current = location.key;
      navDepth += 1;
    }
  }, [location.key]);

  // Keep the handler stable: react-router's `navigate` identity changes on
  // every navigation, which would otherwise tear the listener down and
  // hide/re-show the button on each route change.
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  useEffect(() => {
    if (!backButton) return;
    if (visible) backButton.show(); else backButton.hide();
    const handler = () => goBackRef.current();
    backButton.onClick(handler);
    return () => {
      backButton.offClick(handler);
      backButton.hide();
    };
  }, [backButton, visible]);
}
