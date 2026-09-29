import * as React from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/useHaptic";

/**
 * Inset grouped lists — Apple's Settings pattern. A <ListGroup> is one rounded
 * surface holding <ListRow>s; hairlines between rows start where the text
 * does (after the icon tile), not at the card's edge.
 */

type GroupProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: React.ReactNode;
  footer?: React.ReactNode;
};

const ListGroup = React.forwardRef<HTMLDivElement, GroupProps>(
  ({ className, label, footer, children, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-2", className)} {...props}>
      {label && (
        <div className="px-5 text-caption font-semibold text-muted">{label}</div>
      )}
      <div className="surface overflow-hidden">{children}</div>
      {footer && (
        <div className="px-5 text-caption text-muted">{footer}</div>
      )}
    </div>
  ),
);
ListGroup.displayName = "ListGroup";

type RowProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  before?: React.ReactNode;
  after?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  chevron?: boolean;
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  /** Where the hairline under this row starts, px. Defaults to the text edge. */
  inset?: number;
};

const ListRow = React.forwardRef<HTMLDivElement, RowProps>(
  (
    {
      className,
      before,
      after,
      title,
      subtitle,
      chevron,
      selected,
      destructive,
      disabled,
      inset,
      onClick,
      ...props
    },
    ref,
  ) => {
    const haptic = useHaptic();
    const interactive = !!onClick && !disabled;
    const start = inset ?? (before ? 60 : 20);

    return (
      <div
        ref={ref}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-disabled={disabled || undefined}
        onClick={
          interactive
            ? e => { haptic.selection(); onClick?.(e); }
            : undefined
        }
        onKeyDown={
          interactive
            ? e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        style={{ ["--inset" as string]: `${start}px` }}
        className={cn(
          "relative flex min-h-[52px] items-center gap-3.5 px-4 py-2.5",
          // hairline: starts at the text edge, absent under the last row
          "after:pointer-events-none after:absolute after:bottom-0 after:right-0 after:left-[var(--inset)] after:h-px after:bg-hairline-soft last:after:hidden",
          interactive && "tap cursor-pointer transition-colors duration-150 active:bg-[color:var(--row-press)] focus-visible:outline-none focus-visible:bg-[color:var(--row-press)]",
          selected && "bg-coral-bright/10",
          disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        {before && <div className="flex shrink-0 items-center justify-center">{before}</div>}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-body-md",
              destructive ? "text-error" : "text-ink",
            )}
          >
            {title}
          </div>
          {subtitle && (
            <div className="mt-px truncate text-body-sm text-muted">{subtitle}</div>
          )}
        </div>
        {after && <div className="flex shrink-0 items-center gap-2">{after}</div>}
        {chevron && (
          <ChevronRight className="size-[18px] shrink-0 text-muted-soft" strokeWidth={2.2} />
        )}
      </div>
    );
  },
);
ListRow.displayName = "ListRow";

export { ListGroup, ListRow };
