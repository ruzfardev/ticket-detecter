import { useEffect, useState } from "react";

/**
 * Seconds left on a server-side deadline, ticking every second between fetches.
 *
 * The server reports `seconds` as of the moment the data arrived
 * (`fetchedAt`, e.g. react-query's `dataUpdatedAt`). Polling every few seconds
 * alone makes the clock jump in steps, which reads as broken on the one screen
 * where the user is racing it. Returns null while there is no deadline.
 */
export function useCountdown(seconds: number | null | undefined, fetchedAt: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  const active = seconds !== null && seconds !== undefined;

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, fetchedAt]);

  if (!active) return null;
  return Math.max(0, seconds - Math.floor((now - fetchedAt) / 1000));
}

/** 125 → "2:05" */
export function formatMmSs(secs: number | null): string {
  if (secs === null) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
