import * as m from "motion/react-m";

import { cn } from "@/lib/utils";

type Props = {
  /** Journey time, sat on the line ("13:18"). */
  label?: string;
  /** A coral dot travels the line — a train under way. Hero surfaces only. */
  moving?: boolean;
  /** Draw in white, for use on the luminous coral pane. */
  onPrimary?: boolean;
  className?: string;
};

/**
 * origin ○┄┄┄┄ 13:18 ┄┄┄┄● destination — the line between two times on a ticket.
 * Dashed like a perforation; optionally a small train-dot rides along it.
 */
export function RouteLine({ label, moving, onPrimary, className }: Props) {
  return (
    <div className={cn("relative flex min-w-0 flex-1 items-center self-end pb-[7px]", className)} aria-hidden>
      <span className={cn("size-[9px] shrink-0 rounded-full border-2 bg-transparent", onPrimary ? "border-on-primary/80" : "border-muted-soft")} />
      <div className={cn("relative mx-1.5 flex h-0 min-w-0 flex-1 items-center border-t-[1.5px] border-dashed", onPrimary ? "border-on-primary/50" : "border-hairline")}>
        {moving && (
          <m.span
            className={cn(
              "absolute -top-[4.5px] size-[7px] rounded-full",
              onPrimary
                ? "bg-on-primary shadow-[0_0_10px_rgb(255_255_255/0.9)]"
                : "bg-coral-bright shadow-[0_0_10px_hsl(var(--coral-bright))]",
            )}
            animate={{ left: ["0%", "100%"] }}
            transition={{ duration: 3.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.8 }}
          />
        )}
        {label && (
          <span className={cn(
              "tnum absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-pill px-2 py-0.5 text-[11px] font-semibold",
              onPrimary ? "bg-on-primary/22 text-on-primary" : "bg-surface-strong text-muted",
            )}>
            {label}
          </span>
        )}
      </div>
      <span className={cn("size-[9px] shrink-0 rounded-full", onPrimary ? "bg-on-primary" : "bg-muted-soft")} />
    </div>
  );
}
