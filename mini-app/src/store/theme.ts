import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
};

/**
 * User's appearance preference. "system" (default) follows the Telegram
 * client theme (or the OS outside Telegram); "light"/"dark" force it.
 * Read by useThemeSync, which applies the `.dark` class + Telegram chrome.
 */
export const useTheme = create<ThemeState>()(
  persist(
    set => ({
      mode: "system",
      setMode: mode => set({ mode }),
    }),
    {
      name: "td-theme",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
