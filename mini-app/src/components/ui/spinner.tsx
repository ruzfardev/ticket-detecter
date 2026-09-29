import { cn } from "@/lib/utils";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = { sm: 16, md: 24, lg: 36 };

/** A quiet ring with one bright arc, turning. Colour follows `currentColor`
 *  (coral by default) so it works inside buttons too. */
export function Spinner({ size = "md", className }: Props) {
  const px = SIZE[size];
  return (
    <svg
      role="progressbar"
      aria-label="Yuklanmoqda"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("ring-spin text-coral-bright", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
