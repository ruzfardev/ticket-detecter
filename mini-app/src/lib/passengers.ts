/**
 * Who needs a seat, who rides on a lap — the rules eticket's own booking form
 * applies, so the wizard can say so before the order is ever placed.
 */
import type { Friend } from "@/api/client";

export const MAX_SEATED = 4;
/** Under this age a child rides free on an adult's lap, without a seat. */
export const LAP_CHILD_UNDER = 5;
/** From this age a passenger counts as an adult and may bring children. */
export const ADULT_FROM = 16;

/** Completed years on the travel date; null when either date is unknown. */
export function ageOn(birthIso: string | null | undefined, travelIso: string | undefined): number | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthIso ?? "");
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(travelIso ?? "");
  if (!b || !t) return null;
  let years = Number(t[1]) - Number(b[1]);
  if (Number(t[2]) < Number(b[2]) || (Number(t[2]) === Number(b[2]) && Number(t[3]) < Number(b[3]))) {
    years -= 1;
  }
  return years;
}

export type AgeBand = "adult" | "minor" | "lap";

/** Unknown age is treated as an adult — the safe default for a seat. */
export function ageBand(age: number | null): AgeBand {
  if (age == null) return "adult";
  if (age < LAP_CHILD_UNDER) return "lap";
  if (age < ADULT_FROM) return "minor";
  return "adult";
}

export function bandOf(f: Friend, travelDate: string | undefined): AgeBand {
  return ageBand(ageOn(f.birth_day, travelDate));
}

/** Why this group cannot be booked as chosen, or null when it can. */
export function passengerProblem(
  friends: Friend[], travelDate: string | undefined,
  seatedIds: number[], lapIds: number[],
): string | null {
  const band = (id: number) => {
    const f = friends.find(x => x.id === id);
    return f ? bandOf(f, travelDate) : "adult";
  };
  const adults = seatedIds.filter(id => band(id) === "adult").length;
  const minors = seatedIds.filter(id => band(id) === "minor").length;
  if ((minors > 0 || lapIds.length > 0) && adults === 0) {
    return "Bola faqat katta yo'lovchi bilan sayohat qila oladi";
  }
  if (lapIds.length > adults) {
    return "Har bir katta yo'lovchi quchog'ida bittadan bola";
  }
  return null;
}
