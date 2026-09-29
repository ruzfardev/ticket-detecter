import type { QueryClient } from "@tanstack/react-query";

import {
  getRailwayStatus, listOrders, listSubscriptions, listTickets, type Me,
} from "./client";

/** Home reads these for a few seconds before asking again, so the hand-off from
 *  the launch screen (which just fetched them) does not fetch them twice. */
export const HOME_STALE_MS = 5_000;

/**
 * Get Home's data moving while the launch screen is still up. Without it Home
 * opens on a skeleton, swaps to content a beat later, and then — once eticket
 * has answered — a ticket card lands on top and shoves everything down. With
 * it the common case is one calm arrival.
 *
 * Resolves when the cheap, DB-backed queries are in; the eticket-backed ones
 * (orders, tickets: seconds) are only started, never awaited. Never rejects:
 * a failed prefetch just leaves Home to fetch for itself.
 */
export async function warmHome(qc: QueryClient, me: Me): Promise<void> {
  // /auth/tg answers with exactly what /me does — one round trip saved.
  qc.setQueryData(["me"], me);

  await Promise.allSettled([
    qc.prefetchQuery({ queryKey: ["subs"], queryFn: listSubscriptions, staleTime: HOME_STALE_MS }),
    qc.prefetchQuery({ queryKey: ["railwayAccount"], queryFn: getRailwayStatus, staleTime: HOME_STALE_MS }),
  ]);

  if (qc.getQueryData<{ linked?: boolean }>(["railwayAccount"])?.linked) {
    void qc.prefetchQuery({ queryKey: ["orders"], queryFn: listOrders });
    void qc.prefetchQuery({ queryKey: ["tickets"], queryFn: listTickets, staleTime: 5 * 60_000 });
  }
}
