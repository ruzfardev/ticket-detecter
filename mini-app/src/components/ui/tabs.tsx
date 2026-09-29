import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

/**
 * Segmented tabs on top of Radix Tabs (roles, arrow keys, focus all from
 * Radix). Same look as <Segmented>: a glass lens that slides between triggers.
 * The Root tracks the active value itself so triggers know whether to draw it.
 */
const TabsCtx = React.createContext<{ value?: string; id: string }>({ id: "" });

const Tabs = ({
  value, defaultValue, onValueChange, ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>) => {
  const [inner, setInner] = React.useState(defaultValue);
  const current = value ?? inner;
  const id = React.useId();
  return (
    <TabsCtx.Provider value={{ value: current, id }}>
      <TabsPrimitive.Root
        value={current}
        onValueChange={v => { setInner(v); onValueChange?.(v); }}
        {...props}
      />
    </TabsCtx.Provider>
  );
};

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "relative grid w-full auto-cols-fr grid-flow-col rounded-pill bg-surface-strong/70 p-1",
      "shadow-[inset_0_1px_2px_hsl(var(--shadow)/0.14),inset_0_0_0_0.5px_hsl(var(--hairline)/0.7)]",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, value, ...props }, ref) => {
  const ctx = React.useContext(TabsCtx);
  const active = ctx.value === value;
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "tap relative inline-flex min-h-[36px] select-none items-center justify-center gap-1.5 rounded-pill px-3",
        "text-body-sm font-semibold transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-bright",
        "disabled:pointer-events-none disabled:opacity-50",
        active ? "text-ink" : "text-muted",
        className,
      )}
      {...props}
    >
      {active && (
        <m.span
          layoutId={`${ctx.id}-lens`}
          transition={spring.lens}
          className="lens absolute inset-0 rounded-pill"
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">{children}</span>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("focus-visible:outline-none", className)} {...props}>
    <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring.smooth}>
      {children}
    </m.div>
  </TabsPrimitive.Content>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
