import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TileTone =
  | "coral" | "teal" | "amber" | "green" | "red" | "blue" | "violet" | "pink" | "gray" | "ink";

type Props = {
  icon: LucideIcon;
  tone?: TileTone;
  /** Quiet tinted square with a coloured glyph, instead of the solid tile. */
  soft?: boolean;
  /** Edge length in px. 30 is a list row; 44 a feature row. */
  size?: number;
  className?: string;
};

/** Settings-style rounded square carrying one glyph. Radius is 30 % of the
 *  edge so it stays concentric inside a 26pt card at 16pt padding. */
export function IconTile({ icon: Icon, tone = "coral", soft, size = 30, className }: Props) {
  return (
    <span
      aria-hidden
      className={cn("tile", `tile--${tone}`, soft && "tile--soft", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
    >
      <Icon size={Math.round(size * 0.58)} strokeWidth={soft ? 2 : 2.1} />
    </span>
  );
}
