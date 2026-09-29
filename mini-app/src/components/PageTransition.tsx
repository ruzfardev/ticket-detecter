import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import * as m from "motion/react-m";

import { spring } from "@/lib/motion";
import { isTabbedRoute } from "@/lib/routes";

/**
 * Screen-to-screen motion. A push slides the new screen in from the right on a
 * spring, a pop brings it back from the left, and moving between tabs settles
 * in place with a small swell — as iOS does for each.
 *
 * Deliberately entrance-only, and transform-only for pushes: the outgoing
 * screen is gone at once (nothing waits on an exit, so it never adds latency),
 * and no opacity is ever applied above the glass — an ancestor at opacity < 1
 * is a "backdrop root", which would blind every pane of glass below it until
 * the animation ended, then pop the blur in.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navType = useNavigationType();
  const to = location.pathname;

  const prev = useRef<string | null>(null);
  const from = prev.current;
  useEffect(() => { prev.current = to; }, [to]);

  // Tab switches, and the hand-off from the launch screen, settle in place.
  const tabSwitch = from !== null && (from === "/" || isTabbedRoute(from)) && isTabbedRoute(to);
  const initial =
    from === null ? false :
    tabSwitch ? { opacity: 0, scale: 0.985 } :
    { x: navType === "POP" ? -28 : 46 };

  // `overflow-x: clip` (not `hidden`): a page arriving from the right must not
  // widen the document — iOS would let the whole page be panned sideways for a
  // moment — yet clip, unlike hidden, creates no scroll container, so the
  // sticky top bar inside keeps sticking to the viewport.
  return (
    <div className="overflow-x-clip">
      <m.div
        key={to}
        initial={initial}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        transition={spring.smooth}
      >
        {children}
      </m.div>
    </div>
  );
}
