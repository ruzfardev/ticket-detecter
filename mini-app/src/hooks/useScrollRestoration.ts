import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Tab roots keep their own scroll position, like a native tab bar. */
const TAB_ROOTS = new Set(["/home", "/tickets", "/orders", "/premium", "/settings"]);

/**
 * Scroll like a native app. Going forward starts a page at the top; going back
 * (and switching between tabs) returns to where you were. The browser's own
 * restoration cannot do this in an SPA — the content is not there yet when it
 * tries — so it is switched off and done here, retrying for a few frames while
 * late data makes the page tall enough.
 */
export function useScrollRestoration() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const keyOf = (l: { pathname: string; key: string }) => (TAB_ROOTS.has(l.pathname) ? l.pathname : l.key);
  const current = useRef(keyOf(location));

  useEffect(() => {
    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const onScroll = () => positions.current.set(current.current, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      history.scrollRestoration = prev;
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    current.current = keyOf(location);
    const restore = navType === "POP" || TAB_ROOTS.has(location.pathname);
    const target = restore ? positions.current.get(current.current) ?? 0 : 0;
    window.scrollTo(0, target);
    if (target === 0) return;
    let frames = 0;
    let raf = 0;
    const settle = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= target || frames++ > 12) window.scrollTo(0, Math.min(target, Math.max(0, max)));
      else raf = requestAnimationFrame(settle);
    };
    raf = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
}
