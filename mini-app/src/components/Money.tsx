import { cn } from "@/lib/utils";

type Props = {
  stars: number;
  className?: string;
  /** "amber" tints the star glyph with the warm accent; default keeps it ink-tone. */
  tint?: "amber" | "ink" | "on-dark";
};

export function Money({ stars, className, tint = "amber" }: Props) {
  const star =
    tint === "amber" ? "text-accent-amber" :
    tint === "on-dark" ? "text-on-dark" :
    "text-ink";
  return (
    <span className={cn("inline-flex items-baseline gap-1 tabular-nums font-medium", className)}>
      <span>{stars.toLocaleString()}</span>
      <span className={star}>★</span>
    </span>
  );
}
