/** "2026-09-30" → "30 sen" — compact Uzbek date for list rows and chips. */
const MONTHS_UZ = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

export function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS_UZ[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${month}`;
}

const MONTHS_UZ_FULL = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

/** "2026-08" → "Avgust 2026". */
export function formatMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  return `${MONTHS_UZ_FULL[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** "2026-08" shifted by `delta` months → "2026-09" / "2026-07"; wraps years. */
export function shiftMonth(ym: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const n = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  const y = Math.floor(n / 12);
  const mo = (n % 12) + 1;
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/**
 * Tashkent wall clock as "YYYY-MM-DD HH:MM:SS" — the shape eticket uses for
 * departure and arrival, so the two compare as plain strings. Uzbekistan is
 * UTC+5 all year; there is no DST to account for.
 */
export function tashkentNow(): string {
  return new Date(Date.now() + 5 * 3_600_000)
    .toISOString().slice(0, 19).replace("T", " ");
}

/** The current calendar month in Tashkent, "YYYY-MM". */
export function tashkentMonth(): string {
  return tashkentNow().slice(0, 7);
}
