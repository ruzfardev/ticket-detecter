import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-medium text-button transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
    "disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-coral text-on-primary hover:bg-coral-active active:bg-coral-active rounded-md",
        secondary:
          "bg-canvas text-ink border border-hairline hover:bg-surface-soft rounded-md",
        ghost:
          "bg-transparent text-ink hover:bg-surface-card rounded-md",
        dark:
          "bg-surface-dark-elevated text-on-dark hover:bg-surface-dark-soft rounded-md",
        link:
          "bg-transparent text-coral underline-offset-4 hover:underline px-0 h-auto",
        destructive:
          "bg-transparent text-error border border-hairline hover:bg-error/5 rounded-md",
      },
      size: {
        // 44px meets WCAG 2.5.5 + Apple HIG primary CTA height
        default: "h-11 px-5 py-3",
        sm: "h-10 px-4 text-body-sm",
        lg: "h-12 px-6 text-body-md",
        icon: "h-11 w-11 p-0 rounded-pill",
      },
      full: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      full: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, full }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
