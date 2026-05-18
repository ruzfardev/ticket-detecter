import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { authTg } from "@/api/client";
import { Screen } from "@/components/Screen";
import { Wordmark } from "@/components/Wordmark";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

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

  return (
    <Screen center padded>
      <div className="flex flex-col items-center gap-5 text-center max-w-sm">
        <Wordmark size="lg" />
        <h1 className="font-display text-display-md text-ink tracking-tight">
          Sizning chipta kuzatuvchingiz
        </h1>
        <p className="text-body-md text-muted">
          Marshrut tanlang — bo'sh joy paydo bo'lganda darhol xabar oling.
        </p>

        {error ? (
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-body-sm text-error">Ulanishda xato.</p>
            <Button
              onClick={() => {
                started.current = false;
                mutate();
              }}
            >
              Qayta urinish
            </Button>
          </div>
        ) : (
          <div className="pt-3">
            <Spinner size="lg" />
            {isPending && (
              <p className="mt-3 text-body-sm text-muted-soft">Ulanmoqda...</p>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}
