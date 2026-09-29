import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** Above the perforation: the trip itself. */
  top: ReactNode;
  /** Below it: the small print (date, car, seat). */
  bottom?: ReactNode;
  /** "tint" is a coral wash (today's trip); "coral" the luminous pane (urgent). */
  tone?: "surface" | "tint" | "coral";
  /** Show the card as chosen (a coral ring). */
  selected?: boolean;
  className?: string;
};

/**
 * A ticket: a card with a half-round bite out of each side where the stub
 * tears off — the punched-ticket motif of the Chiptachi mark — and a dashed
 * perforation between the two bites. The bites are a CSS mask positioned in
 * pixels from the measured height of the top half, so they land exactly on the
 * perforation whatever the content.
 *
 * Masks clip shadows, so the shadow is a drop-shadow on a wrapper.
 */
export function TicketShell({ top, bottom, tone = "surface", selected, className }: Props) {
  const topRef = useRef<HTMLDivElement>(null);
  const [notchY, setNotchY] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = topRef.current;
    if (!el || !bottom) return;
    const measure = () => setNotchY(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bottom]);

  const coral = tone === "coral";
  return (
    <div className={cn("ticket-shadow", selected && "drop-shadow-[0_0_10px_hsl(var(--coral-bright)/0.45)]", className)}>
      <div
        className={cn(
          "rounded-[26px]",
          bottom && notchY !== null && "ticket-notch",
          coral && "glass-prominent text-on-primary",
          tone === "tint" && "ticket-tint",
          tone === "surface" && "bg-surface-card shadow-[inset_0_1px_0_var(--card-edge)]",
          selected && tone === "surface" && "bg-coral-bright/[0.12]",
        )}
        style={bottom && notchY !== null ? ({ "--notch-y": `${notchY}px` } as CSSProperties) : undefined}
      >
        <div ref={topRef} className="p-4">{top}</div>
        {bottom && (
          <>
            <div className="mx-[22px]">
              <div className={cn("perf", coral && "border-on-primary/40")} />
            </div>
            <div className="px-4 pb-4 pt-3.5">{bottom}</div>
          </>
        )}
      </div>
    </div>
  );
}
