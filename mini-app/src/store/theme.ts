import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark";
/** Colour palette. "cream" is Chiptachi coral (default); "eticket" mirrors
 *  eticket.railway.uz's turquoise; "emerald" is deep green + gold. */
export type Palette = "eticket" | "cream" | "emerald";
/** How much glass the device is asked to draw. "auto" measures the device
 *  once and settles on full or lite; "off" is reserved for the OS asking for
 *  reduced transparency, never a stored choice. */
export type FxPref = "auto" | "full" | "lite";

type ThemeState = {
  mode: ThemeMode;
  palette: Palette;
  fx: FxPref;
  setMode: (m: ThemeMode) => void;
  setPalette: (p: Palette) => void;
  setFx: (f: FxPref) => void;
};

/**
 * User's appearance preference. "system" (default) follows the Telegram
 * client theme (or the OS outside Telegram); "light"/"dark" force it.
 * Read by useThemeSync, which applies the `.dark` class, the palette's
 * `data-theme` attribute and the Telegram chrome colors. index.html reads
 * the same key before first paint, so keep the shape stable.
 */
export const useTheme = create<ThemeState>()(
  persist(
    set => ({
      mode: "system",
      palette: "cream",
      fx: "auto",
      setMode: mode => set({ mode }),
      setPalette: palette => set({ palette }),
      setFx: fx => set({ fx }),
    }),
    {
      name: "td-theme",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
