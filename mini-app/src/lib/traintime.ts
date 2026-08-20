/**
 * railway.uz reports train times as a naive Tashkent wall-clock string:
 *
 *     "30.09.2026 01:10"        // DD.MM.YYYY HH:MM — no T, no offset, no Z
 *
 * There is no timezone field anywhere in the payload. These are always local
 * station times (the eticket site says as much under every result), so they are
 * displayed verbatim — never fed through `new Date()`, which would reinterpret
 * them in the viewer's timezone and shift the clock for anyone travelling.
 */

const DOTTED = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2})/;

export type TrainMoment = {
  time: string;          // "01:10"
  date: string | null;   // "2026-09-30", null when unparseable
};

export function parseTrainMoment(raw: string | null | undefined): TrainMoment {
  const s = (raw ?? "").trim();
  if (!s) return { time: "—", date: null };

  const m = DOTTED.exec(s);
  if (m) {
    const [, dd, mm, yyyy, hh, min] = m;
    return { time: `${hh}:${min}`, date: `${yyyy}-${mm}-${dd}` };
  }

  // ISO fallback, in case the upstream format ever changes under us.
  if (s.includes("T") && s.length >= 16) {
    return { time: s.slice(11, 16), date: s.slice(0, 10) };
  }
  return { time: s, date: null };
}

/** Just the clock, e.g. "01:10". */
export function trainTime(raw: string | null | undefined): string {
  return parseTrainMoment(raw).time;
}

/**
 * Whole-day difference between departure and arrival, for the "+1" marker on
 * overnight trains. Returns 0 when either side is unparseable.
 */
export function dayOffset(
  departure: string | null | undefined,
  arrival: string | null | undefined,
): number {
  const d = parseTrainMoment(departure).date;
  const a = parseTrainMoment(arrival).date;
  if (!d || !a) return 0;
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`);
  if (Number.isNaN(ms)) return 0;
  return Math.round(ms / 86_400_000);
}
