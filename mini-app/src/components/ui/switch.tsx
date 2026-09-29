import * as React from "react";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * iOS's switch: a 51×31 track and a thumb that stretches under your finger
 * (27 → 34pt) and springs to the other side. The track fills with the
 * palette's primary and glows a little when on.
 */
export function Switch({ checked, onCheckedChange, disabled, className, ...aria }: Props) {
  const haptic = useHaptic();
  const [pressed, setPressed] = React.useState(false);
  const width = pressed ? 34 : 27;
  const x = checked ? 51 - width - 2 : 2;
  const release = () => setPressed(false);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { haptic.selection(); onCheckedChange(!checked); }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      className={cn(
        "tap relative h-[31px] w-[51px] shrink-0 rounded-full transition-[background-color,box-shadow] duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-bright focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        checked
          ? "bg-coral shadow-[0_0_16px_-3px_hsl(var(--coral-bright)/0.6),inset_0_0_0_0.5px_hsl(var(--coral-active))]"
          : "bg-ink/16 shadow-[inset_0_0_0_0.5px_hsl(var(--shadow)/0.16)]",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...aria}
    >
      <m.span
        aria-hidden
        initial={false}
        animate={{ x, width }}
        transition={spring.bouncy}
        className="absolute left-0 top-[2px] h-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.25),0_1px_1px_rgb(0_0_0/0.12),inset_0_-1px_1px_rgb(0_0_0/0.06)]"
      />
    </button>
  );
}
