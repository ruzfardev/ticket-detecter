import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import * as m from "motion/react-m";

import { spring } from "@/lib/motion";
import { NavEntryContext, type NavEntry } from "@/lib/navEntry";
import { isTabbedRoute } from "@/lib/routes";

/**
 * Screen-to-screen motion. A push slides the new screen in from the right on a
 * spring, a pop brings it back from the left — and moving between tabs does
 * nothing at all, exactly as on iOS.
 *
 * Deliberately entrance-only and transform-only: the outgoing screen is gone at
 * once (nothing waits on an exit, so it never adds latency), and the incoming
 * one is fully opaque from its first frame. No opacity is ever applied above the
 * glass — an ancestor at opacity < 1 is a "backdrop root", which blinds every
 * pane of glass below it until the animation ends, then pops the blur in — and
 * a page that starts at opacity 0 is a blank screen for the first 100 ms after
 * a tap, which reads as lag no matter how fast the frames are.
 *
 * The kind of arrival is published as context so the screen's own blocks know
 * whether to stagger in (`launch`, `push`) or simply be there (`tab`, `pop`).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navType = useNavigationType();
  const to = location.pathname;

  const prev = useRef<string | null>(null);
  const from = prev.current;
  useEffect(() => { prev.current = to; }, [to]);

  // Decided once per screen: re-renders of this component must not change how
  // an already-mounted screen thinks it arrived.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entry = useMemo<NavEntry>(() => {
    if (from === null || from === "/") return "launch";
    if (isTabbedRoute(from) && isTabbedRoute(to)) return "tab";
    return navType === "POP" ? "pop" : "push";
  }, [to]);

  const initial = entry === "push" ? { x: 46 } : entry === "pop" ? { x: -28 } : false;

  // `overflow-x: clip` (not `hidden`): a page arriving from the right must not
  // widen the document — iOS would let the whole page be panned sideways for a
  // moment — yet clip, unlike hidden, creates no scroll container, so the
  // sticky top bar inside keeps sticking to the viewport.
  return (
    <div className="overflow-x-clip">
      <m.div key={to} initial={initial} animate={{ x: 0 }} transition={spring.smooth}>
        <NavEntryContext.Provider value={entry}>{children}</NavEntryContext.Provider>
      </m.div>
    </div>
  );
}
