import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

type Props = {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** `row` = mark beside the name (headers); `stack` = mark above (splash). */
  lockup?: "row" | "stack";
  /** Only the mark, no name. */
  markOnly?: boolean;
};

const MARK = { sm: 20, md: 28, lg: 64 } as const;
// Name sizes keep the mark : text ratio fixed across lockups.
const NAME = {
  sm: "text-title-sm font-semibold",
  md: "text-title-lg font-semibold",
  lg: "text-display-sm font-semibold",
} as const;

/**
 * Logo + the name "Chiptachi" as plain text (never inside the SVG), so the
 * name stays crisp at every size and follows the ink token like the mark.
 */
export function Wordmark({ className, size = "md", lockup = "row", markOnly }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-ink select-none",
        lockup === "stack" ? "flex-col gap-3" : "flex-row gap-2",
        className,
      )}
    >
      <Logo size={MARK[size]} />
      {!markOnly && (
        <span className={cn("tracking-[-0.02em] leading-none", NAME[size])}>Chiptachi</span>
      )}
    </span>
  );
}
