import { create } from "zustand";

/** The glass quality actually in force (see styles/glass.css). */
export type FxTier = "full" | "lite" | "off";

export const useFxStore = create<{ tier: FxTier; setTier: (t: FxTier) => void }>(set => ({
  tier: (document.documentElement.getAttribute("data-fx") as FxTier) || "full",
  setTier: tier => set({ tier }),
}));
