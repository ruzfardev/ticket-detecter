import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** The round check used by every multi-select: empty ring → coral disc that pops. */
export function SelectMark({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-6 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-200",
        checked
          ? "bg-coral text-on-primary shadow-[0_3px_10px_-3px_hsl(var(--coral-bright)/0.7),inset_0_1px_0.5px_rgb(255_255_255/0.5)]"
          : "border-[1.5px] border-muted-soft/60",
        className,
      )}
    >
      {checked && <Check key="c" className="pop-in size-3.5" strokeWidth={3.4} />}
    </span>
  );
}

/** Same silhouette for single-select: a ring with a dot. */
export function RadioMark({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200",
        checked ? "border-coral-bright" : "border-muted-soft/60",
        className,
      )}
    >
      {checked && <span className="pop-in size-3 rounded-full bg-coral shadow-[0_0_8px_hsl(var(--coral-bright)/0.6)]" />}
    </span>
  );
}
