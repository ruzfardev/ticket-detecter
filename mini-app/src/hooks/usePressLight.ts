import { useCallback, useRef, type PointerEvent } from "react";

/**
 * Press illumination for glass: while a finger is down, a glow blooms from
 * exactly where it touched (styles/glass.css reads --px / --py and
 * data-pressed). Spread `bind` on the element, pass `ref` through.
 * Deliberately DOM-only — no state, no re-renders.
 */
export function usePressLight<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  const down = useCallback((e: PointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--py", `${((e.clientY - r.top) / r.height) * 100}%`);
    el.dataset.pressed = "true";
  }, []);
  const up = useCallback(() => {
    if (ref.current) delete ref.current.dataset.pressed;
  }, []);

  return {
    ref,
    bind: { onPointerDown: down, onPointerUp: up, onPointerLeave: up, onPointerCancel: up },
  };
}
