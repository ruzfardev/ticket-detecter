import * as React from "react";
import * as m from "motion/react-m";
import { cva, type VariantProps } from "class-variance-authority";

import { cn, mergeRefs } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useHaptic } from "@/hooks/useHaptic";
import { usePressLight } from "@/hooks/usePressLight";
import { Spinner } from "./spinner";

/**
 * Buttons are glass. `primary` is the one luminous coral pane on a screen —
 * the action you are meant to take. Everything else is clear glass or plain
 * text. All of them are capsules (Apple's shape for controls), 44pt or taller,
 * shrink on touch and release with a little overshoot, and glow from the
 * point you pressed.
 */
const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-button tap " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-bright focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
    "disabled:pointer-events-none disabled:opacity-45 disabled:saturate-50 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "glass-prominent",
        secondary: "glass text-ink",
        tint: "glass glass-tint text-coral-ink",
        ghost: "text-ink hover:bg-ink/5 active:bg-ink/10",
        dark: "bg-surface-dark-elevated text-on-dark shadow-pop",
        link: "text-coral-ink",
        destructive: "glass text-error",
      },
      size: {
        // 50pt is Apple's large control height; nothing here is under 38.
        default: "h-[50px] px-6 rounded-pill",
        sm: "h-[38px] px-4 text-[15px] font-semibold rounded-pill",
        lg: "h-[56px] px-7 rounded-pill",
        icon: "h-11 w-11 p-0 rounded-pill",
      },
      full: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "link", class: "h-auto min-h-[44px] rounded-md px-1" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "default",
      full: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Show a spinner and ignore taps (the label stays, so width never jumps). */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, full, loading, disabled, children, onClick,
      onPointerDown, onPointerUp, onPointerLeave, onPointerCancel, type = "button", ...props },
    ref,
  ) => {
    const haptic = useHaptic();
    const { ref: pressRef, bind } = usePressLight<HTMLButtonElement>();
    const glassy = variant !== "ghost" && variant !== "link" && variant !== "dark";

    return (
      <m.button
        ref={mergeRefs(ref, pressRef)}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, full }), className)}
        whileTap={{ scale: variant === "link" ? 0.98 : 0.965 }}
        transition={spring.bouncy}
        onClick={e => {
          if (variant !== "link") haptic.impact(variant === "primary" ? "medium" : "light");
          onClick?.(e);
        }}
        onPointerDown={e => { if (glassy) bind.onPointerDown(e); onPointerDown?.(e); }}
        onPointerUp={e => { bind.onPointerUp(); onPointerUp?.(e); }}
        onPointerLeave={e => { bind.onPointerLeave(); onPointerLeave?.(e); }}
        onPointerCancel={e => { bind.onPointerCancel(); onPointerCancel?.(e); }}
        {...(props as any)}
      >
        {loading && <Spinner size="sm" className="text-current" />}
        {children}
      </m.button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
