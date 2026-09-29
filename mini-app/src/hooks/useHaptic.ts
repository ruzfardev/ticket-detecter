import { useCallback } from "react";
import { useTelegram } from "./useTelegram";

type Impact = "light" | "medium" | "heavy" | "rigid" | "soft";
type Notif = "success" | "warning" | "error";

/**
 * Lightweight haptic helper around Telegram's HapticFeedback. Returns no-op
 * fns when running outside Telegram so calls are safe everywhere.
 */
export function useHaptic() {
  const { haptic } = useTelegram();
  return {
    impact: useCallback(
      (style: Impact = "light") => haptic?.impactOccurred?.(style),
      [haptic],
    ),
    selection: useCallback(() => haptic?.selectionChanged?.(), [haptic]),
    notify: useCallback(
      (style: Notif) => haptic?.notificationOccurred?.(style),
      [haptic],
    ),
  };
}
