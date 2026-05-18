import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-3 py-1 font-medium",
  {
    variants: {
      variant: {
        // Default cream pill — feature labels
        pill:    "bg-surface-card text-ink text-caption",
        // Coral signature — "NEW", "BETA"
        coral:   "bg-coral text-on-primary text-caption-upper uppercase",
        // Dark — counterpoint on cream
        dark:    "bg-surface-dark text-on-dark text-caption",
        // Soft outline on cream
        outline: "bg-canvas text-ink hairline text-caption",
        // Status — small semantic dots
        success: "bg-success/15 text-success text-caption",
        warning: "bg-warning/15 text-warning text-caption",
        muted:   "bg-surface-soft text-muted text-caption",
      },
    },
    defaultVariants: { variant: "pill" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
