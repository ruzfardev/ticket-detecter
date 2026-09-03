import type { CarInsight } from "@/api/client";

/**
 * One quiet line under a car type: how this departure is moving and what
 * usually happens on the route. Empty when there is nothing worth saying.
 */
export function insightText(i: CarInsight | null | undefined): string | null {
  if (!i) return null;
  const parts: string[] = [];
  if (i.trend_delta != null && i.trend_delta !== 0 && i.trend_span_h) {
    const span = i.trend_span_h >= 20 ? "24 soatda" : `${i.trend_span_h} soatda`;
    const sign = i.trend_delta < 0 ? "−" : "+";
    parts.push(`${span} ${sign}${Math.abs(i.trend_delta)} joy`);
  }
  if (i.sellout_days_p50 != null) {
    const d = Math.round(i.sellout_days_p50);
    parts.push(d <= 0 ? "odatda jo'nash kuni tugaydi" : `odatda ${d} kun oldin tugaydi`);
  } else if (i.instances_n >= 3 && i.sold_out_n === 0) {
    parts.push("odatda tugamaydi");
  }
  return parts.length ? parts.join(" · ") : null;
}
