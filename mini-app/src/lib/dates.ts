/** "2026-09-30" → "30 sen" — compact Uzbek date for list rows and chips. */
const MONTHS_UZ = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

export function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS_UZ[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${month}`;
}
