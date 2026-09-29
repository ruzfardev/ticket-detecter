import { create } from "zustand";

/**
 * Open sheets, innermost last. Telegram's native Back button (and Android's
 * back gesture) should close the sheet you are looking at before it leaves
 * the screen behind it — useBackButton asks here first.
 */
type Overlay = { id: string; close: () => void };

export const useOverlays = create<{
  stack: Overlay[];
  push: (o: Overlay) => void;
  remove: (id: string) => void;
}>(set => ({
  stack: [],
  push: o => set(s => ({ stack: [...s.stack, o] })),
  remove: id => set(s => ({ stack: s.stack.filter(x => x.id !== id) })),
}));

/** Close the topmost sheet. Returns whether there was one. */
export function closeTopOverlay(): boolean {
  const { stack } = useOverlays.getState();
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}
