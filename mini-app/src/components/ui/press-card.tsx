import * as React from "react";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useHaptic } from "@/hooks/useHaptic";

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> & {
  /** "surface": an opaque card. "glass": a pane. "none": bring your own. */
  material?: "surface" | "glass" | "none";
};

/**
 * A whole card that is one tap target — a banner, a stat tile, an upsell.
 * It gives under the finger (a spring, not a fade) and ticks the haptics.
 */
export const PressCard = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, material = "surface", onClick, type = "button", ...props }, ref) => {
    const haptic = useHaptic();
    return (
      <m.button
        ref={ref}
        type={type}
        whileTap={{ scale: 0.97 }}
        transition={spring.bouncy}
        onClick={e => { haptic.selection(); onClick?.(e); }}
        className={cn(
          "tap block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-bright focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          material === "surface" && "surface",
          material === "glass" && "glass rounded-xl",
          className,
        )}
        {...(props as any)}
      />
    );
  },
);
PressCard.displayName = "PressCard";
