import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark";
/** Color palette. "eticket" (default) mirrors eticket.railway.uz's own
 *  colors; "cream" is the original warm palette; "emerald" is ours. */
export type Palette = "eticket" | "cream" | "emerald";

type ThemeState = {
  mode: ThemeMode;
  palette: Palette;
  setMode: (m: ThemeMode) => void;
  setPalette: (p: Palette) => void;
};

/**
 * User's appearance preference. "system" (default) follows the Telegram
 * client theme (or the OS outside Telegram); "light"/"dark" force it.
 * Read by useThemeSync, which applies the `.dark` class, the palette's
 * `data-theme` attribute and the Telegram chrome colors.
 */
export const useTheme = create<ThemeState>()(
  persist(
    set => ({
      mode: "system",
      palette: "eticket",
      setMode: mode => set({ mode }),
      setPalette: palette => set({ palette }),
    }),
    {
      name: "td-theme",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
