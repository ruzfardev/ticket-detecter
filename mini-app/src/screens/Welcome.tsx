import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { TrainFront, RotateCw } from "lucide-react";

import { authTg } from "@/api/client";

export function Welcome() {
  const navigate = useNavigate();
  const { mutate, isPending, error } = useMutation({
    mutationFn: authTg,
    onSuccess: () => navigate("/home", { replace: true }),
  });

  useEffect(() => { mutate(); }, [mutate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 32,
        textAlign: "center",
      }}
    >
      <span
        className="w-rise"
        style={{
          width: 84, height: 84, borderRadius: 24,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "var(--accent)", color: "var(--accent-tx)",
          boxShadow: "var(--shadow-fab)",
        }}
      >
        <TrainFront size={42} strokeWidth={1.9} />
      </span>
      <div className="w-rise" style={{ animationDelay: "0.06s" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>Chiptachi</div>
        <div style={{ fontSize: 14.5, color: "var(--hint)", marginTop: 6, maxWidth: 280 }}>
          {error
            ? "Ulanishda xato — Mini App ni qaytadan oching."
            : isPending
              ? "Ulanmoqda…"
              : "Tayyor"}
        </div>
      </div>
      {!error && (
        <RotateCw
          size={22}
          strokeWidth={2}
          color="var(--accent)"
          style={{ animation: "w-spin 0.9s linear infinite" }}
        />
      )}
    </div>
  );
}
