import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

type Props = {
  children: ReactNode;
  /** Helper text shown above the action (e.g. why a button is disabled). */
  hint?: ReactNode;
  className?: string;
};

/**
 * The screen's one primary action, floating at the bottom in the thumb zone.
 * No bar around it: content dissolves under a progressive blur (the scroll
 * edge) and the button floats as a glass capsule. A hint, if any, rides above
 * it in its own small pane — the reason the button is disabled, in words.
 *
 * Portalled to <body> and fixed: pages carry a transform while they arrive,
 * which would otherwise pin this to the page instead of to the screen.
 */
export function StickyAction({ children, hint, className }: Props) {
  return (
    <>
      {/* Keep the last block of content clear of the floating action. */}
      <div aria-hidden className="h-[124px]" />
      {createPortal(
        <m.div
          className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-40", className)}
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={spring.smooth}
        >
          <div className="scrim-bottom" aria-hidden />
          <div className="page-frame pointer-events-auto relative pb-[calc(var(--safe-b)+14px)] pt-3">
            {hint && (
              <div
                role="status"
                className="glass mx-auto mb-3 w-fit max-w-full rounded-[18px] px-4 py-2 text-center text-caption text-body"
              >
                {hint}
              </div>
            )}
            {children}
          </div>
        </m.div>,
        document.body,
      )}
    </>
  );
}
