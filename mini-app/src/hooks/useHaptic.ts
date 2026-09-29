import { useMemo } from "react";
import { useTelegram } from "./useTelegram";

type Impact = "light" | "medium" | "heavy" | "rigid" | "soft";
type Notif = "success" | "warning" | "error";

/**
 * Haptics are shared by the design system (buttons, rows, toggles, tabs,
 * sheets) *and* by screens that add their own. Without care a tap would buzz
 * twice — once from the button, once from the handler — so impacts and
 * selection ticks that land within a few ms of each other collapse into one.
 * Notifications (success / warning / error) always go through: they mean
 * something.
 */
let last = 0;
const gate = (ms: number) => {
  const now = performance.now();
  if (now - last < ms) return false;
  last = now;
  return true;
};

/**
 * Lightweight haptic helper around Telegram's HapticFeedback. Returns no-op
 * fns when running outside Telegram so calls are safe everywhere. The returned
 * object is stable, so it is safe in effect dependency lists.
 */
export function useHaptic() {
  const { haptic } = useTelegram();
  return useMemo(() => ({
    impact: (style: Impact = "light") => {
      if (gate(45)) haptic?.impactOccurred?.(style);
    },
    selection: () => {
      if (gate(30)) haptic?.selectionChanged?.();
    },
    notify: (style: Notif) => {
      last = performance.now();
      haptic?.notificationOccurred?.(style);
    },
  }), [haptic]);
}
