import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("", {
  variants: {
    variant: {
      // Content card: an opaque-ish surface over the ambient light.
      feature: "surface text-ink",
      // Quieter: hairline only, for secondary blocks.
      outline: "surface-soft text-ink",
      // Dark product card.
      dark: "rounded-xl bg-surface-dark text-on-dark shadow-pop",
      // Full-bleed accent: the luminous coral pane.
      coral: "glass-prominent rounded-xl",
      // A pane of glass — hero moments only (each one is a live blur).
      glass: "glass rounded-xl text-ink",
      // No chrome: a section wrapper.
      plain: "bg-transparent",
    },
    pad: {
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
      none: "p-0",
    },
  },
  defaultVariants: {
    variant: "feature",
    pad: "md",
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, pad, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, pad }), className)} {...props} />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-1.5", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-display text-display-sm", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardSubtitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-body-sm text-muted", className)} {...props} />
  ),
);
CardSubtitle.displayName = "CardSubtitle";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-body-md text-body", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center pt-4", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardSubtitle, CardContent, CardFooter };
