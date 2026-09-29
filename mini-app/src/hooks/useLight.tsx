import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { useMotionValue, useSpring, type MotionValue } from "motion/react";

import { useFxStore } from "@/store/fx";
import { tgVersionAtLeast } from "@/lib/platform";

/**
 * The light source. Glass catches light, so hero surfaces carry a specular
 * highlight that slides as the phone tilts — the one place the illusion of
 * a physical pane is made explicit.
 *
 * `lx` / `ly` are springs in -1..1 (light from the left / above at -1). They
 * are MotionValues, so following them costs no React renders: only the few
 * elements that read them move, on the compositor.
 *
 * Sources, best first: Telegram's DeviceOrientation API (radians, no iOS
 * permission dance) → the browser's deviceorientation event where it needs no
 * permission (Android) → mouse position → scroll. Sensors only run while some
 * mounted element has asked for the light (`retain`), and never on the "lite"
 * / "off" tiers or under reduced motion.
 */
type Light = {
  lx: MotionValue<number>;
  ly: MotionValue<number>;
  /** Ask for the light for as long as the caller is mounted. */
  retain: () => () => void;
};

const Ctx = createContext<Light | null>(null);
const clamp = (v: number) => Math.min(1, Math.max(-1, v));

export function LightProvider({ children }: { children: ReactNode }) {
  const tier = useFxStore(s => s.tier);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const lx = useSpring(rx, { stiffness: 70, damping: 16, mass: 0.7 });
  const ly = useSpring(ry, { stiffness: 70, damping: 16, mass: 0.7 });

  const users = useRef(0);
  const [active, setActive] = useState(false);
  const retain = useCallback(() => {
    users.current += 1;
    setActive(true);
    return () => {
      users.current -= 1;
      if (users.current <= 0) setActive(false);
    };
  }, []);

  useEffect(() => {
    if (!active || tier !== "full") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const undo: Array<() => void> = [];
    let sensor = false;

    const tg = window.Telegram?.WebApp;
    const DO = tg?.DeviceOrientation;
    if (DO?.start && tgVersionAtLeast("8.0")) {
      const onChange = () => {
        sensor = true;
        rx.set(clamp((DO.gamma ?? 0) / 0.5));
        ry.set(clamp(((DO.beta ?? 0.8) - 0.8) / 0.5)); // ~45° is how a phone is held
      };
      tg.onEvent("deviceOrientationChanged", onChange);
      try { DO.start({ refresh_rate: 60, need_absolute: false }); } catch { /* not supported */ }
      undo.push(() => {
        tg.offEvent("deviceOrientationChanged", onChange);
        try { DO.stop?.(); } catch { /* noop */ }
      });
    } else if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as any).requestPermission !== "function"
    ) {
      const on = (e: DeviceOrientationEvent) => {
        if (e.gamma == null || e.beta == null) return;
        sensor = true;
        rx.set(clamp(e.gamma / 28));
        ry.set(clamp((e.beta - 45) / 28));
      };
      window.addEventListener("deviceorientation", on);
      undo.push(() => window.removeEventListener("deviceorientation", on));
    }

    const onPointer = (e: PointerEvent) => {
      if (sensor || e.pointerType !== "mouse") return;
      rx.set(clamp((e.clientX / innerWidth - 0.5) * 2));
      ry.set(clamp((e.clientY / innerHeight - 0.5) * 2));
    };
    const onScroll = () => {
      if (sensor) return;
      ry.set(clamp(-0.5 + Math.min(window.scrollY / 1400, 1)));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    undo.push(() => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
    });

    return () => { undo.forEach(f => f()); rx.set(0); ry.set(0); };
  }, [active, tier, rx, ry]);

  const value = useMemo(() => ({ lx, ly, retain }), [lx, ly, retain]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLight(): Light {
  const light = useContext(Ctx);
  if (!light) throw new Error("useLight outside <LightProvider>");
  return light;
}
