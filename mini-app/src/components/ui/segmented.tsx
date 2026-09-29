import * as React from "react";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useHaptic } from "@/hooks/useHaptic";

export type SegmentOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  /** Small glyph above/before the label. */
  icon?: React.ReactNode;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** "row": icon beside label (default). "stack": icon above label. */
  layout?: "row" | "stack";
  className?: string;
  "aria-label"?: string;
};

/**
 * Segmented control. The selection is a glass "lens" that slides — with a
 * spring, so it overshoots a touch — under whichever segment is chosen. The
 * same lens (shared `layoutId`) travels between segments instead of one
 * fading out while another fades in.
 */
export function Segmented<T extends string>({
  value, onChange, options, layout = "row", className, ...aria
}: Props<T>) {
  const id = React.useId();
  const haptic = useHaptic();

  return (
    <div
      role="radiogroup"
      className={cn(
        "relative grid auto-cols-fr grid-flow-col rounded-pill bg-surface-strong/70 p-1",
        "shadow-[inset_0_1px_2px_hsl(var(--shadow)/0.14),inset_0_0_0_0.5px_hsl(var(--hairline)/0.7)]",
        className,
      )}
      {...aria}
    >
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (active) return;
              haptic.selection();
              onChange(o.value);
            }}
            className={cn(
              "tap relative flex items-center justify-center rounded-pill text-body-sm font-semibold",
              "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-bright",
              layout === "stack" ? "min-h-[56px] flex-col gap-1 py-2 text-caption" : "min-h-[36px] gap-1.5 px-3",
              active ? "text-ink" : "text-muted",
            )}
          >
            {active && (
              <m.span
                layoutId={`${id}-lens`}
                transition={spring.lens}
                className="lens absolute inset-0 rounded-pill"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 [&_svg]:size-[18px]">
              {o.icon}
              {layout === "row" && o.label}
            </span>
            {layout === "stack" && <span className="relative z-10">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
