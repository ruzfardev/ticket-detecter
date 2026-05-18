import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button, Placeholder, Spinner } from "@telegram-apps/telegram-ui";

import { authTg } from "@/api/client";
import { Screen, Stack } from "@/ui";

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
    <Screen center>
      <Placeholder
        header="Ticket Detector"
        description={
          error
            ? "Ulanishda xato. Qaytadan urinib ko'ring."
            : isPending
              ? "Ulanmoqda..."
              : "Tayyor"
        }
      >
        {error ? (
          <Stack direction="column" gap={3}>
            <Button onClick={() => { started.current = false; mutate(); }}>
              Qayta urinish
            </Button>
          </Stack>
        ) : (
          <Spinner size="l" />
        )}
      </Placeholder>
    </Screen>
  );
}
