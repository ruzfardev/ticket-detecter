import { cn } from "@/lib/utils";

type Props = {
  /** Rendered size in px (square). */
  size?: number;
  className?: string;
  /** Pulse a halo ring around the punch-dot — the app's "working" signal. */
  live?: boolean;
  /** Paint the punch-dot with the error token instead of the primary. */
  tone?: "primary" | "error";
  title?: string;
};

/**
 * The Chiptachi mark: a solid ticket silhouette with a punched hole, three
 * perforation dashes along the tear line, and one live dot sitting in the hole.
 *
 * Theme-aware by construction — the body is `currentColor` (so it takes the
 * surrounding text color, ink on light canvases and off-white on dark) and the
 * dot is the palette's primary token, so it recolors for eticket / cream /
 * emerald and for light / dark without any per-theme asset. The same dot is the
 * live-status dot used in the UI, which is the point: brand and state share
 * one element.
 *
 * Static exports (favicon, apple-touch-icon, BotFather splash) cannot read CSS
 * variables — see public/mark.svg and public/splash-placeholder.svg, which are
 * the same path with baked colors.
 */
export function Logo({ size = 28, className, live, tone = "primary", title = "Chiptachi" }: Props) {
  const dot = tone === "error" ? "hsl(var(--error))" : "hsl(var(--coral))";
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label={title}
      className={cn("block shrink-0", className)}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M12 16H37.5A4.5 4.5 0 0 0 46.5 16H52A6 6 0 0 1 58 22V42A6 6 0 0 1 52 48H46.5A4.5 4.5 0 0 0 37.5 48H12A6 6 0 0 1 6 42V22A6 6 0 0 1 12 16ZM30 32A8 8 0 1 0 14 32A8 8 0 1 0 30 32ZM41 22.5H43V27H41ZM41 29.75H43V34.25H41ZM41 37H43V41.5H41Z"
      />
      {live && (
        <circle
          className="logo-halo"
          cx="22"
          cy="32"
          r="4.25"
          stroke={dot}
          strokeWidth="1.5"
          opacity="0"
        />
      )}
      <circle cx="22" cy="32" r="4.25" fill={dot} />
    </svg>
  );
}
