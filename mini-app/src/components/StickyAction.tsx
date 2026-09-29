import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Helper text shown above the action (e.g. why a button is disabled). */
  hint?: ReactNode;
  className?: string;
};

/**
 * A fixed/sticky bottom action bar. Used on wizard screens so the primary CTA
 * stays in the thumb zone regardless of scroll position. Respects bottom
 * safe-area; a top fade-mask hints at content scrolling underneath.
 */
export function StickyAction({ children, hint, className }: Props) {
  return (
    <>
      {/* Spacer so the last bit of content isn't hidden under the bar. */}
      <div aria-hidden className="h-24" />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 pointer-events-none",
          className,
        )}
      >
        {/* Fade mask — soft gradient from transparent to cream */}
        <div className="h-4 bg-gradient-to-b from-transparent to-canvas" aria-hidden />
        <div
          className="pointer-events-auto bg-canvas px-4 pt-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
          {hint && (
            <p className="text-body-sm text-muted text-center mb-2">{hint}</p>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
