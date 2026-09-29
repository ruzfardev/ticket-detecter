import { useId } from "react";

import { cn } from "@/lib/utils";

type Tint = "amber" | "ink" | "on-dark";

type Props = {
  stars: number;
  className?: string;
  /** "amber" (default) is the gold Telegram Star; "ink" follows the text
   *  colour; "on-dark" is the gold star tuned for a dark or luminous card. */
  tint?: Tint;
};

/* A five-point star with round joins — chubby, like Telegram's own Star.
   Outer radius 10.2, inner 5.1, centred so the drawn star (stroke included)
   sits in the middle of the 24-unit box. */
const STAR =
  "M12 2.7 15 8.77 21.7 9.75 16.85 14.48 18 21.15 12 18 6 21.15 7.15 14.48 2.3 9.75 9 8.77Z";

/**
 * The star glyph on its own. Gold with a sheen on top; on light backgrounds a
 * thin amber rim keeps it crisp against white, on dark ones the gold alone is
 * bright enough. Size it with `className` (it defaults to 0.82em, the height
 * of a capital, so it sits level with the digits beside it).
 */
export function Star({ className, tint = "amber" }: { className?: string; tint?: Tint }) {
  // SVG gradient ids must be unique per page; React's ids contain colons.
  const sheen = `star-${useId().replace(/:/g, "")}`;
  const gold = tint !== "ink";
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={cn(
        "size-[0.82em] shrink-0 overflow-visible",
        tint === "amber" && "text-amber-bright",
        tint === "on-dark" && "text-amber-bright",
        className,
      )}
    >
      <defs>
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity={gold ? 0.62 : 0.28} />
          <stop offset="0.58" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Rim: a hair of deeper amber around the gold, light mode only. */}
      {tint === "amber" && (
        <path
          d={STAR}
          className="fill-none stroke-accent-amber/70 dark:stroke-transparent"
          strokeWidth="3.6"
          strokeLinejoin="round"
        />
      )}
      <path d={STAR} fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d={STAR} fill={`url(#${sheen})`} stroke={`url(#${sheen})`} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** An amount of Telegram Stars: the number, then the star. Never wraps. */
export function Money({ stars, className, tint = "amber" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.22em] whitespace-nowrap font-medium tabular-nums",
        className,
      )}
    >
      <span>{stars.toLocaleString()}</span>
      <Star tint={tint} />
      <span className="sr-only">★</span>
    </span>
  );
}
