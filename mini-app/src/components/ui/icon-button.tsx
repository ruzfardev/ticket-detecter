import * as React from "react";

import { Button, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";

type Props = Omit<ButtonProps, "size" | "full" | "children"> & {
  /** Required: an icon alone says nothing to a screen reader. */
  "aria-label": string;
  children: React.ReactNode;
};

/** A round glass control, 44pt: back, close, avatar, toolbar actions. */
export const IconButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "secondary", children, ...props }, ref) => (
    <Button
      ref={ref}
      size="icon"
      variant={variant}
      className={cn("[&_svg]:size-[20px]", className)}
      {...props}
    >
      {children}
    </Button>
  ),
);
IconButton.displayName = "IconButton";
