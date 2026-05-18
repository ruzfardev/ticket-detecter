import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A grouped list pattern: <ListGroup> (with optional label/footer) wraps a
 * cream-card surface; <ListRow> renders an interactive row inside.
 *
 * The cream card surface + interior hairline-soft dividers match the
 * Anthropic editorial pacing — no shadows, color-block first.
 */

type GroupProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: React.ReactNode;
  footer?: React.ReactNode;
};

const ListGroup = React.forwardRef<HTMLDivElement, GroupProps>(
  ({ className, label, footer, children, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-2", className)} {...props}>
      {label && (
        <div className="px-4 text-caption-upper uppercase text-muted">{label}</div>
      )}
      <div className="bg-surface-card rounded-lg overflow-hidden divide-y divide-hairline-soft">
        {children}
      </div>
      {footer && (
        <div className="px-4 text-body-sm text-muted">{footer}</div>
      )}
    </div>
  ),
);
ListGroup.displayName = "ListGroup";

type RowProps = React.HTMLAttributes<HTMLDivElement> & {
  before?: React.ReactNode;
  after?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  chevron?: boolean;
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
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
      onClick,
      ...props
    },
    ref,
  ) => {
    const interactive = !!onClick && !disabled;
    return (
      <div
        ref={ref}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={disabled ? undefined : onClick}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        className={cn(
          "flex items-center gap-3 px-4 py-3 min-h-[56px]",
          interactive && "cursor-pointer active:bg-hairline-soft transition-colors",
          selected && "bg-hairline-soft",
          disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        {before && <div className="flex-shrink-0 flex items-center justify-center">{before}</div>}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-body-md font-medium truncate",
              destructive ? "text-error" : "text-ink",
            )}
          >
            {title}
          </div>
          {subtitle && (
            <div className="text-body-sm text-muted truncate mt-0.5">{subtitle}</div>
          )}
        </div>
        {after && <div className="flex-shrink-0 flex items-center">{after}</div>}
        {chevron && (
          <ChevronRight className="h-5 w-5 text-muted-soft flex-shrink-0" strokeWidth={1.75} />
        )}
      </div>
    );
  },
);
ListRow.displayName = "ListRow";

export { ListGroup, ListRow };
