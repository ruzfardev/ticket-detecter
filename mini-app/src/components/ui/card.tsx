import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-lg",
  {
    variants: {
      variant: {
        // Feature card — slightly darker than canvas, no border, no shadow
        feature: "bg-surface-card text-ink",
        // Pricing / model card — canvas with hairline border
        outline: "bg-canvas text-ink hairline",
        // Dark product mockup card — navy fill
        dark: "bg-surface-dark text-on-dark",
        // Coral callout — full bleed accent
        coral: "bg-coral text-on-primary",
        // Plain — no chrome, used as section wrapper
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
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, pad, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, pad }), className)} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-1.5", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-display text-display-sm", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardSubtitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-body-sm text-muted", className)} {...props} />
  )
);
CardSubtitle.displayName = "CardSubtitle";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-body-md text-body", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center pt-4", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardSubtitle, CardContent, CardFooter };
