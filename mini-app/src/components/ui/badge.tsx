import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-[3px] text-[12px] font-semibold leading-4",
  {
    variants: {
      variant: {
        // Neutral pill — feature labels
        pill:    "bg-surface-strong text-ink",
        // Tinted coral — the state you should notice ("Faol", "Bron")
        coral:   "bg-coral-bright/16 text-coral-ink",
        // Luminous coral — "Premium", "Eng tejamli"
        solid:   "glass-prominent",
        dark:    "bg-surface-dark text-on-dark",
        outline: "bg-transparent text-ink ring-1 ring-inset ring-hairline",
        success: "bg-success/14 text-success",
        warning: "bg-warning/16 text-warning",
        error:   "bg-error/14 text-error",
        muted:   "bg-ink/6 text-muted",
      },
    },
    defaultVariants: { variant: "pill" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
