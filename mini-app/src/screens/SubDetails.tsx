import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import {
  CalendarDays, TrainFront, Armchair, Activity,
  Pause, Play, Trash2, ArrowDownToLine, ArrowUpToLine, Minus, Clock, Send,
} from "lucide-react";

import {
  deleteSubscription, listSubscriptions, patchSubscription,
} from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { PageHeader } from "@/components/wallet/PageHeader";
import { WalletSection } from "@/components/wallet/WalletSection";
import { WalletRow } from "@/components/wallet/WalletRow";

const dot = (Icon: any) => (
  <span
    style={{
      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: "var(--accent-soft)", color: "var(--accent)",
    }}
  >
    <Icon size={17} strokeWidth={2} />
  </span>
);

function berthLabel(berth: string) {
  if (berth === "lower") return { Icon: ArrowDownToLine, text: "pastki" };
  if (berth === "upper") return { Icon: ArrowUpToLine, text: "tepa" };
  return { Icon: Minus, text: "har qanday" };
}

export function SubDetails() {
  const { id } = useParams();
  const subId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showConfirm, haptic } = useTelegram();

  const { data, isLoading } = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });
  const sub = data?.subscriptions.find(s => s.id === subId);

  const toggle = useMutation({
    mutationFn: () => patchSubscription(subId, { is_active: !sub?.is_active }),
    onSuccess: () => {
      haptic?.impactOccurred?.("light");
      qc.invalidateQueries({ queryKey: ["subs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteSubscription(subId),
    onSuccess: () => {
      toast.success("O'chirildi");
      qc.invalidateQueries({ queryKey: ["subs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate("/home", { replace: true });
    },
  });

  if (isLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
        <Spinner size="l" />
      </div>
    );
  }
  if (!sub) {
    return (
      <div style={{ overflowX: "hidden" }}>
        <PageHeader title="Kuzatuv" />
        <div style={{ padding: 32, textAlign: "center", color: "var(--hint)" }}>Topilmadi</div>
      </div>
    );
  }

  const b = berthLabel(sub.berth);

  const actionBtn = (
    label: string, Icon: any, onClick: () => void,
    opts: { danger?: boolean; loading?: boolean } = {},
  ) => (
    <button
      type="button"
      className="w-press"
      onClick={onClick}
      disabled={opts.loading}
      style={{
        all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center",
        justifyContent: "center", gap: 8, width: "100%", height: 48, borderRadius: 14,
        fontSize: 16, fontWeight: 600, cursor: "pointer",
        background: opts.danger ? "transparent" : "var(--card)",
        color: opts.danger ? "#FF3B30" : "var(--accent)",
        boxShadow: opts.danger ? "none" : "var(--shadow)",
      }}
    >
      <Icon size={18} strokeWidth={2} />
      {label}
    </button>
  );

  return (
    <div style={{ overflowX: "hidden" }}>
      <PageHeader title={`${sub.dep_name} → ${sub.arr_name}`} />

      <div style={{ padding: "4px 12px 24px" }}>
        <div className="w-rise">
          <WalletSection
            header="Kuzatuv"
            headerRight={
              <span
                style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                  color: sub.is_active ? "var(--accent)" : "var(--hint)",
                  background: sub.is_active ? "var(--accent-soft)" : "var(--bg)",
                }}
              >
                {sub.is_active ? "Aktiv" : "Pauza"}
              </span>
            }
          >
            <WalletRow before={dot(CalendarDays)} title={sub.travel_date} subtitle="Sana" />
            <WalletRow before={dot(TrainFront)} title={sub.train_number ?? "Har qanday poyezd"} subtitle="Poyezd" />
            <WalletRow
              before={dot(Armchair)}
              title={sub.car_types.join(", ") || "Barcha vagonlar"}
              subtitle="Vagon turi"
            />
            <WalletRow
              before={dot(b.Icon)}
              title={b.text}
              subtitle="Joy turi"
            />
          </WalletSection>
        </div>

        <div className="w-rise" style={{ animationDelay: "0.05s" }}>
          <WalletSection header="Statistika">
            <WalletRow before={dot(Send)} title={String(sub.notif_count)} subtitle="Yuborilgan xabarlar" />
            <WalletRow
              before={dot(Clock)}
              title={new Date(sub.created_at).toLocaleDateString()}
              subtitle="Yaratilgan"
            />
            {sub.last_notified_at && (
              <WalletRow
                before={dot(Activity)}
                title={new Date(sub.last_notified_at).toLocaleString()}
                subtitle="Oxirgi xabar"
              />
            )}
          </WalletSection>
        </div>

        <div
          className="w-rise"
          style={{ animationDelay: "0.1s", display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}
        >
          {actionBtn(
            sub.is_active ? "Pauza qilish" : "Davom ettirish",
            sub.is_active ? Pause : Play,
            () => toggle.mutate(),
            { loading: toggle.isPending },
          )}
          {actionBtn(
            "O'chirish",
            Trash2,
            async () => { if (await showConfirm("O'chirishni xohlaysizmi?")) remove.mutate(); },
            { danger: true, loading: remove.isPending },
          )}
        </div>
      </div>
    </div>
  );
}
