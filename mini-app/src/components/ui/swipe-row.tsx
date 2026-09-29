import { useEffect, useRef, type ReactNode } from "react";
import * as m from "motion/react-m";
import { animate, useMotionValue, useTransform } from "motion/react";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useHaptic } from "@/hooks/useHaptic";

export type SwipeAction = {
  key: string;
  label: string;
  icon: ReactNode;
  tone: "amber" | "red" | "coral" | "gray";
  onSelect: () => void;
};

const TONE: Record<SwipeAction["tone"], string> = {
  amber: "bg-amber-bright text-[hsl(30_60%_12%)]",
  red:   "bg-[hsl(4_72%_52%)] text-white",
  coral: "bg-coral text-on-primary",
  gray:  "bg-muted-soft text-white",
};

const W = 76; // width of one action

/** Only one row is ever open; opening another closes it. */
let closeOpen: (() => void) | null = null;

/**
 * iOS swipe actions: drag a row left and its actions bloom out from behind
 * it. Release past halfway (or flick) and it snaps open on a spring; tap the
 * row, or another row, and it closes. Vertical scrolling is untouched
 * (horizontal drag only), and nothing here is gesture-only: whatever the
 * actions do is also reachable by opening the row.
 *
 * The divider belongs to the wrapper, so a row inside a ListGroup keeps its
 * hairline while the content slides over it.
 */
export function SwipeRow({
  children, actions, className,
}: { children: ReactNode; actions: SwipeAction[]; className?: string }) {
  const haptic = useHaptic();
  const x = useMotionValue(0);
  const total = actions.length * W;
  const reveal = useTransform(x, [-total, -total * 0.25, 0], [1, 0.5, 0]);
  const scale = useTransform(x, [-total, 0], [1, 0.7]);
  const open = useRef(false);
  const dragged = useRef(false);

  const snap = (to: number) => {
    open.current = to !== 0;
    animate(x, to, spring.snappy);
    if (to !== 0) {
      closeOpen?.();
      closeOpen = () => snap(0);
    } else if (closeOpen) {
      closeOpen = null;
    }
  };
  useEffect(() => () => { if (closeOpen) closeOpen = null; }, []);

  return (
    <div className={cn("relative overflow-hidden after:pointer-events-none after:absolute after:bottom-0 after:left-5 after:right-0 after:h-px after:bg-hairline-soft last:after:hidden", className)}>
      <m.div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ opacity: reveal, scale, transformOrigin: "right center", width: total }}
        // A pointer shortcut only: the same actions live on the subscription's
        // own screen, which is what assistive tech is pointed at.
        aria-hidden
      >
        {actions.map(a => (
          <button
            key={a.key}
            type="button"
            tabIndex={-1}
            onClick={() => { haptic.impact("light"); snap(0); a.onSelect(); }}
            className={cn("tap flex flex-1 flex-col items-center justify-center gap-1 text-[12px] font-semibold", TONE[a.tone])}
          >
            <span className="[&_svg]:size-[22px]">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </m.div>

      <m.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -total, right: 0 }}
        dragElastic={{ left: 0.08, right: 0 }}
        dragMomentum={false}
        onDragStart={() => { dragged.current = true; }}
        onDragEnd={(_, info) => {
          const shouldOpen = info.offset.x < -total * 0.4 || info.velocity.x < -450;
          if (shouldOpen && !open.current) haptic.impact("light");
          snap(shouldOpen ? -total : 0);
          // the click that follows a drag must not activate the row
          setTimeout(() => { dragged.current = false; }, 0);
        }}
        onClickCapture={e => {
          if (dragged.current) { e.stopPropagation(); e.preventDefault(); return; }
          if (open.current) { e.stopPropagation(); e.preventDefault(); snap(0); }
        }}
        className="relative touch-pan-y"
      >
        {children}
      </m.div>
    </div>
  );
}
