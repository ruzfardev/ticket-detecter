import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as m from "motion/react-m";
import { AnimatePresence, useDragControls } from "motion/react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useHaptic } from "@/hooks/useHaptic";
import { useOverlays } from "@/store/overlays";
import { IconButton } from "./icon-button";

/**
 * Bottom sheet, iOS 26 style: a floating pane of glass inset from the screen
 * edges with a 38pt radius, a grabber, and a scrim that dims what's behind.
 * Radix Dialog supplies focus trapping, Escape, aria and scroll lock; motion
 * supplies the spring in/out and the drag. Pull down (or flick) to dismiss;
 * anywhere the finger doesn't start on the grabber, the content scrolls.
 * Telegram's Back button closes the top sheet first (store/overlays).
 */
const Ctx = React.createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

type RootProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

function Sheet({ open: openProp, defaultOpen, onOpenChange, children }: RootProps) {
  const [inner, setInner] = React.useState(!!defaultOpen);
  const open = openProp ?? inner;
  const setOpen = React.useCallback(
    (v: boolean) => { setInner(v); onOpenChange?.(v); },
    [onOpenChange],
  );

  const id = React.useId();
  React.useEffect(() => {
    if (!open) return;
    useOverlays.getState().push({ id, close: () => setOpen(false) });
    return () => useOverlays.getState().remove(id);
  }, [open, id, setOpen]);

  return (
    <Ctx.Provider value={{ open, setOpen }}>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>{children}</DialogPrimitive.Root>
    </Ctx.Provider>
  );
}

const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

const SheetContent = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "asChild">
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = React.useContext(Ctx);
  const controls = useDragControls();
  const haptic = useHaptic();

  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <m.div
              className="fixed inset-0 z-[60] bg-ink/25 dark:bg-black/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content asChild forceMount {...props}>
            <m.div
              ref={ref}
              className={cn(
                "glass-sheet fixed inset-x-2 z-[61] flex max-h-[88dvh] flex-col overflow-hidden rounded-[38px] focus:outline-none",
                className,
              )}
              style={{ bottom: "calc(var(--safe-b) + 8px)" }}
              initial={{ y: "108%" }}
              animate={{ y: 0 }}
              exit={{ y: "108%" }}
              transition={spring.smooth}
              drag="y"
              dragControls={controls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.04, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 700) {
                  haptic.impact("light");
                  setOpen(false);
                }
              }}
            >
              {/* Grabber: the only place a drag starts, so content can scroll. */}
              <div
                className="flex h-9 shrink-0 cursor-grab touch-none items-center justify-center"
                onPointerDown={e => controls.start(e)}
              >
                <span className="h-[5px] w-10 rounded-full bg-ink/20" />
              </div>
              <DialogPrimitive.Close asChild>
                <IconButton
                  aria-label="Yopish"
                  variant="ghost"
                  className="absolute right-3 top-2 z-10 size-9 bg-ink/6"
                >
                  <X strokeWidth={2.4} />
                </IconButton>
              </DialogPrimitive.Close>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
                {children}
              </div>
            </m.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
});
SheetContent.displayName = "SheetContent";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-display-md text-ink", className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-body-sm text-muted", className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
