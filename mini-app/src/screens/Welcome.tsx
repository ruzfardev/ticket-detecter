import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";

import { authTg } from "@/api/client";
import { warmHome } from "@/api/warm";
import { Screen } from "@/components/Screen";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The launch screen is an auth gate, not a brand moment. Telegram crossfades
 * its own placeholder into our webview in ~200 ms, so this screen is designed
 * as a continuation of it: the mark sits where the placeholder icon was and
 * "gains color" — here, a pane of glass with the dawn light behind it; nothing
 * else animates unless the request is genuinely slow.
 *
 * Loading indication is staged by CSS delay alone (no timers, no JS motion):
 *   - 0 ms      medallion, name and tagline fade/rise in (520 ms, staggered)
 *   - 600 ms+   the dot's halo pulses while auth is still pending
 *   - 1200 ms+  a 3 px rail appears
 * A sub-second auth therefore shows no loading motion at all.
 */
/** The longest the launch screen waits on Home's data. */
const WARM_CAP_MS = 1200;

export function Welcome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const started = useRef(false);
  const { mutate, isPending, error } = useMutation({
    mutationFn: authTg,
    // Hold the launch screen for Home's data — but only briefly: on a slow
    // network Home takes over with its skeleton, as before.
    onSuccess: async me => {
      await Promise.race([warmHome(qc, me), new Promise(r => setTimeout(r, WARM_CAP_MS))]);
      navigate("/home", { replace: true });
    },
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate();
  }, [mutate]);

  const retry = () => {
    started.current = false;
    mutate();
  };

  return (
    <Screen center padded className="min-h-[var(--app-vh,100svh)]">
      {/* The group is nudged down so the mark itself — not the whole column —
          sits near the optical centre, where Telegram's placeholder was. */}
      <div className="flex w-full translate-y-10 flex-col items-center text-center">
        <div className="relative">
          {/* Dawn behind the pane — coral from the upper left, amber from the
              lower right — so the glass has light to bend. Painted, not blurred. */}
          <span
            aria-hidden
            className="splash-in pointer-events-none absolute -left-[88px] -top-[88px] size-[240px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--coral-bright)/0.36),hsl(var(--coral-bright)/0.12)_55%,transparent)]"
          />
          <span
            aria-hidden
            className="splash-in pointer-events-none absolute -left-[20px] -top-[20px] size-[230px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--amber-bright)/0.3),hsl(var(--amber-bright)/0.08)_55%,transparent)]"
          />
          <div
            className={cn(
              "splash-in glass flex size-[128px] items-center justify-center rounded-full text-ink",
              error && "glass-tint [--tint:var(--error)]",
            )}
          >
            <Logo size={64} live={isPending && !error} loop tone={error ? "error" : "primary"} />
          </div>
        </div>

        <h1 className="splash-in mt-6 font-display text-display-lg tracking-[-0.02em] text-ink [animation-delay:80ms]">
          Chiptachi
        </h1>
        <p className="splash-in mt-1 text-body-md text-muted [animation-delay:140ms]">
          Kuzatadi · topadi · oladi
        </p>

        {/* Fixed-height status region: swapping loader ↔ error never moves the mark. */}
        <div className="mt-8 flex h-[92px] w-full flex-col items-center" aria-live="polite">
          {error ? (
            <>
              <p className="text-body-sm text-muted">Ulanib bo'lmadi — internetni tekshiring</p>
              <Button variant="secondary" className="mt-3" onClick={retry} disabled={isPending}>
                <RotateCw strokeWidth={2.2} />
                Qayta urinish
              </Button>
            </>
          ) : (
            <>
              <div className="splash-rail mt-1 motion-reduce:hidden" aria-hidden="true">
                <i />
              </div>
              <p className="hidden text-caption text-muted motion-reduce:block">
                Ulanmoqda…
              </p>
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}
