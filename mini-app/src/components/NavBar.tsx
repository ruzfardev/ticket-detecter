import type { ReactNode } from "react";
import * as m from "motion/react-m";
import { useTransform, type MotionValue } from "motion/react";

import { cn } from "@/lib/utils";

type Props = {
  /** 0 = at rest (large title visible), 1 = collapsed (glass + inline title). */
  progress: MotionValue<number>;
  title?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Replaces the inline title (the wizard puts its step indicator here). */
  center?: ReactNode;
  /** No controls to show: take no room. The bar floats over the page instead
   *  of pushing the large title down, and only appears once it has a title to show. */
  overlay?: boolean;
};

/**
 * The top bar. At rest it is invisible: only the large title below it. As the
 * large title scrolls under, a glass pane fades in behind the bar and the
 * title reappears small in the middle — Apple's collapsing large title.
 * Sticky, not fixed, so it travels with its page during a transition.
 */
export function NavBar({ progress, title, leading, trailing, center, overlay }: Props) {
  const titleY = useTransform(progress, [0, 1], [8, 0]);
  return (
    <header className={cn("sticky top-0 z-30", overlay && "h-0")}>
      <div
        className={cn(overlay && "pointer-events-none absolute inset-x-0 top-0")}
        style={{ paddingTop: "var(--safe-t)" }}
      >
      <m.div aria-hidden className="glass-bar absolute inset-0" style={{ opacity: progress }} />
      <div className="page-frame relative flex h-[var(--nav-h)] items-center gap-3">
        <div className="flex min-w-[44px] shrink-0 justify-start">{leading}</div>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          {center ?? (
            <m.h2
              className="truncate font-display text-title-lg text-ink"
              style={{ opacity: progress, y: titleY }}
            >
              {title}
            </m.h2>
          )}
        </div>
        <div className="flex min-w-[44px] shrink-0 items-center justify-end gap-2">{trailing}</div>
      </div>
      </div>
    </header>
  );
}
