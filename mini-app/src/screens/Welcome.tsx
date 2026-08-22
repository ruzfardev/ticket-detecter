import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { authTg } from "@/api/client";
import { Screen } from "@/components/Screen";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

/**
 * The launch screen is an auth gate, not a brand moment. Telegram crossfades
 * its own placeholder into our webview in ~200 ms, so this screen is designed
 * as a continuation of it: the mark sits where the placeholder icon was and
 * "gains color"; nothing else animates unless the request is genuinely slow.
 *
 * Loading indication is staged by CSS delay alone (no timers):
 *   - 0 ms      mark + name fade/rise in (360 ms)
 *   - 600 ms+   the dot's halo pulses while auth is still pending
 *   - 1200 ms+  a 2 px rail appears
 * A sub-second auth therefore shows no loading motion at all.
 */
export function Welcome() {
  const navigate = useNavigate();
  const started = useRef(false);
  const { mutate, isPending, error } = useMutation({
    mutationFn: authTg,
    onSuccess: () => navigate("/home", { replace: true }),
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
      <div className="flex w-full flex-col items-center text-center translate-y-6">
        <div className="splash-in text-ink">
          <Logo size={64} live={isPending && !error} tone={error ? "error" : "primary"} />
        </div>
        <h1 className="splash-in mt-4 font-display text-display-sm font-semibold tracking-[-0.02em] text-ink [animation-delay:80ms]">
          Chiptachi
        </h1>
        <p className="splash-in mt-1 text-body-sm text-muted [animation-delay:140ms]">
          Kuzatadi · topadi · oladi
        </p>

        {/* Fixed-height status region: swapping loader ↔ error never moves the mark. */}
        <div className="mt-7 flex h-20 w-full flex-col items-center">
          {error ? (
            <>
              <p className="text-body-sm text-muted">Ulanib bo'lmadi — internetni tekshiring</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={retry} disabled={isPending}>
                Qayta urinish
              </Button>
            </>
          ) : (
            <>
              <div className="splash-rail mt-1 motion-reduce:hidden" aria-hidden="true">
                <i />
              </div>
              <p className="hidden text-caption text-muted-soft motion-reduce:block" aria-live="polite">
                Ulanmoqda…
              </p>
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}
