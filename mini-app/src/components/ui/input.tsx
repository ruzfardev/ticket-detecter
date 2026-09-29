import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  before?: React.ReactNode;
  after?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, before, after, ...props }, ref) => {
    if (before || after) {
      return (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border border-hairline bg-canvas px-3 h-10",
            "focus-within:border-coral focus-within:ring-2 focus-within:ring-coral/15 transition-colors",
            className,
          )}
        >
          {before && <span className="text-muted flex-shrink-0">{before}</span>}
          <input
            type={type}
            ref={ref}
            className="flex-1 bg-transparent outline-none text-body-md text-ink placeholder:text-muted-soft min-w-0"
            {...props}
          />
          {after && <span className="text-muted flex-shrink-0">{after}</span>}
        </div>
      );
    }
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-body-md text-ink",
          "placeholder:text-muted-soft outline-none transition-colors",
          "focus:border-coral focus:ring-2 focus:ring-coral/15",
          "disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
