import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Placeholder, Spinner } from "@telegram-apps/telegram-ui";

import { authTg } from "@/api/client";

export function Welcome() {
  const navigate = useNavigate();
  const { mutate, isPending, error } = useMutation({
    mutationFn: authTg,
    onSuccess: () => navigate("/home", { replace: true }),
  });

  useEffect(() => { mutate(); }, [mutate]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <Placeholder
        header="Ticket Detector"
        description={
          error ? "Ulanishda xato — qaytadan oching."
          : isPending ? "Ulanmoqda..."
          : ""
        }
      >
        {!error && <Spinner size="l" />}
      </Placeholder>
    </div>
  );
}
