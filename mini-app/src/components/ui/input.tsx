import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  before?: React.ReactNode;
  after?: React.ReactNode;
}

/**
 * A recessed field: an inner shadow makes it read as a well cut into the
 * surface, and focus lights the well from within (a coral ring + glow).
 * 17px text so iOS never zooms the page on focus.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, before, after, ...props }, ref) => (
    <div
      className={cn(
        "flex h-[52px] items-center gap-2.5 rounded-[18px] px-4",
        "bg-surface-card shadow-[inset_0_1px_2px_hsl(var(--shadow)/0.12),inset_0_0_0_0.5px_hsl(var(--hairline))]",
        "transition-shadow duration-200",
        "focus-within:shadow-[inset_0_1px_2px_hsl(var(--shadow)/0.08),0_0_0_2px_hsl(var(--coral-bright)),0_0_22px_-4px_hsl(var(--coral-bright)/0.45)]",
        "has-[[aria-invalid=true]]:shadow-[0_0_0_2px_hsl(var(--error))]",
        "has-[:disabled]:opacity-60",
        className,
      )}
    >
      {before && <span className="flex shrink-0 items-center text-muted">{before}</span>}
      <input
        type={type}
        ref={ref}
        className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-muted-soft"
        {...props}
      />
      {after && <span className="flex shrink-0 items-center text-muted">{after}</span>}
    </div>
  ),
);
Input.displayName = "Input";

export { Input };
