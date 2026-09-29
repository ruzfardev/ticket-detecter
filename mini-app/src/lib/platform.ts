/** Small facts about where we are running. */

export const isApple = () =>
  /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(navigator.userAgent);

/** True inside a real Telegram client (initData is empty in a plain browser). */
export const inTelegram = () => !!window.Telegram?.WebApp?.initData;

export const tgVersionAtLeast = (v: string): boolean => {
  try { return !!window.Telegram?.WebApp?.isVersionAtLeast?.(v); } catch { return false; }
};
