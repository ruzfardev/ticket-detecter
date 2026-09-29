import { createContext, useContext } from "react";

/**
 * How the current screen was reached — it decides which entrance plays.
 *
 *   launch  first paint, or the hand-off from the launch screen
 *   push    forward into a flow (wizard steps, detail screens)
 *   pop     back
 *   tab     from one tab root to another
 *
 * A tap must show its result at once: iOS switches tabs and reveals the
 * previous screen with no entrance at all, so only `launch` and `push` may
 * stagger their blocks in.
 */
export type NavEntry = "launch" | "push" | "pop" | "tab";

export const NavEntryContext = createContext<NavEntry>("launch");
export const useNavEntry = () => useContext(NavEntryContext);

/** True while the screen is playing an entrance (`launch`, `push`). A screen's own
 *  staggers gate on this so a tab switch or a back tap shows content at once. */
export const useEntering = () => {
  const entry = useNavEntry();
  return entry === "launch" || entry === "push";
};
