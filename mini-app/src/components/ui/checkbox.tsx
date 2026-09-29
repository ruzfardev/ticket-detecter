import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** The same round check as <SelectMark>, but a real, focusable control. */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "tap flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-muted-soft/60",
      "transition-[background-color,box-shadow,border-color] duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-bright focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
      "data-[state=checked]:border-transparent data-[state=checked]:bg-coral data-[state=checked]:text-on-primary",
      "data-[state=checked]:shadow-[0_3px_10px_-3px_hsl(var(--coral-bright)/0.7),inset_0_1px_0.5px_rgb(255_255_255/0.5)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="pop-in flex items-center justify-center text-current">
      <Check className="size-3.5" strokeWidth={3.4} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
