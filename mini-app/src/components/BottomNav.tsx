import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as m from "motion/react-m";
import { useMotionValue, useSpring, useTransform, useVelocity } from "motion/react";
import { Bell, Home, Settings, Ticket } from "lucide-react";

import { listOrders } from "@/api/client";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { TAB_ROUTES } from "@/lib/routes";
import { useHaptic } from "@/hooks/useHaptic";

type Tab = { path: (typeof TAB_ROUTES)[number]; label: string; Icon: typeof Bell };

const TABS: Tab[] = [
  { path: "/home",     label: "Asosiy",     Icon: Home     },
  { path: "/tickets",  label: "Chiptalar",  Icon: Ticket   },
  { path: "/orders",   label: "Buyurtma",   Icon: Bell     },
  { path: "/settings", label: "Sozlamalar", Icon: Settings },
];

/**
 * The floating tab bar — a capsule of Liquid Glass hovering above the safe
 * area. The selection is a glass "lens" that behaves like a drop of liquid:
 *   • it slides between tabs on a spring, stretching as it speeds up and
 *     squashing back as it lands;
 *   • it swells while a finger is on the bar;
 *   • you can pick it up and drag it — the tab under it lights as you pass,
 *     each crossing ticks the haptic engine, and letting go opens that tab.
 * Taps, keyboard and screen readers work as on any tab bar (real buttons).
 *
 * A coral dot on "Buyurtma" says an auto-buy needs you (or is in flight); it
 * reads the orders cache only — the bar itself never causes a request.
 */
export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const haptic = useHaptic();

  const active = TABS.findIndex(t => t.path === location.pathname);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? active;

  const orders = useQuery({ queryKey: ["orders"], queryFn: listOrders, enabled: false });
  const needsYou = !!orders.data?.some(o => o.status === "awaiting_otp");
  const inFlight = !needsYou && !!orders.data?.some(o => o.status === "reserving" || o.status === "paying");

  // The lens: position in "tab units", sprung; stretch and squash from velocity.
  const target = useMotionValue(Math.max(active, 0));
  const idx = useSpring(target, spring.lens);
  const x = useTransform(idx, v => `${v * 100}%`);
  const velocity = useVelocity(idx);
  const lift = useSpring(1, { stiffness: 520, damping: 26 });
  const stretch = useTransform(velocity, v => 1 + Math.min(Math.abs(v) * 0.045, 0.34));
  const squash = useTransform(velocity, v => 1 - Math.min(Math.abs(v) * 0.012, 0.09));
  const scaleX = useTransform([stretch, lift], ([s, l]: number[]) => s * l);
  const scaleY = useTransform([squash, lift], ([s, l]: number[]) => s * l);
  const present = useSpring(active >= 0 ? 1 : 0, { stiffness: 300, damping: 30 });

  useEffect(() => {
    if (active >= 0) target.set(active);
    present.set(active >= 0 ? 1 : 0);
  }, [active, target, present]);

  const trackRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ x0: number; dragging: boolean } | null>(null);
  const lastHover = useRef<number | null>(null);

  /** Fractional tab index under a finger, clamped to the bar. */
  const indexAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.min(TABS.length - 1, Math.max(0, ((clientX - r.left) / r.width) * TABS.length - 0.5));
  };

  const open = (i: number) => {
    if (i === active) {
      // iOS convention — tapping the active tab returns to the top.
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate(TABS[i].path);
  };

  const onDown = (e: PointerEvent<HTMLElement>) => {
    press.current = { x0: e.clientX, dragging: false };
    lift.set(1.1);
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p) return;
    if (!p.dragging && Math.abs(e.clientX - p.x0) > 8) {
      p.dragging = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!p.dragging) return;
    const f = indexAt(e.clientX);
    target.set(f);
    const n = Math.round(f);
    if (n !== lastHover.current) {
      lastHover.current = n;
      setHover(n);
      haptic.selection();
    }
  };
  const onUp = (e: PointerEvent<HTMLElement>) => {
    const p = press.current;
    press.current = null;
    lift.set(1);
    if (!p?.dragging) return; // a tap: the button's own onClick handles it
    const n = Math.round(indexAt(e.clientX));
    lastHover.current = null;
    setHover(null);
    if (n === active) target.set(Math.max(active, 0));
    else { haptic.impact("light"); navigate(TABS[n].path); }
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-5"
      style={{ bottom: "calc(var(--safe-b) + var(--tabbar-gap))" }}
    >
      <m.nav
        aria-label="Asosiy navigatsiya"
        className="glass tap pointer-events-auto relative h-[var(--tabbar-h)] w-full max-w-[400px] rounded-[33px] p-[5px]"
        style={{ touchAction: "pan-y" }}
        initial={{ y: 110, opacity: 0, scale: 0.94 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 110, opacity: 0, scale: 0.94 }}
        transition={spring.smooth}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div ref={trackRef} className="relative h-full">
          <m.span
            aria-hidden
            className="lens-tint absolute inset-y-0 left-0 w-1/4 rounded-[28px]"
            style={{ x, scaleX, scaleY, opacity: present }}
          />
          <div className="relative grid h-full grid-cols-4">
            {TABS.map(({ path, label, Icon }, i) => {
              const on = shown === i;
              const dot = path === "/orders" && (needsYou || inFlight);
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => open(i)}
                  aria-current={active === i ? "page" : undefined}
                  className={cn(
                    "relative z-10 flex h-full flex-col items-center justify-center gap-[3px] rounded-[28px]",
                    "text-[10.5px] font-semibold leading-none transition-colors duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-bright",
                    on ? "text-coral-ink" : "text-body/70",
                  )}
                >
                  <m.span
                    className="relative"
                    animate={{ y: on ? -0.5 : 0, scale: on ? 1.07 : 1 }}
                    transition={spring.bouncy}
                  >
                    <Icon
                      className="size-6"
                      strokeWidth={on ? 2.2 : 1.8}
                      fill={on ? "currentColor" : "none"}
                      fillOpacity={on ? 0.16 : 0}
                    />
                    {dot && (
                      <span
                        aria-label={needsYou ? "SMS kod kerak" : "Buyurtma jarayonda"}
                        className={cn(
                          "live-dot absolute -right-1 -top-0.5 !size-[9px] ring-2 ring-canvas/80",
                          needsYou ? "live-dot--urgent" : "live-dot--still opacity-70",
                        )}
                      />
                    )}
                  </m.span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </m.nav>
    </div>
  );
}
