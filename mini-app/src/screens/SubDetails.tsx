import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button, Cell, List, Section, Spinner,
} from "@telegram-apps/telegram-ui";
import { toast } from "sonner";

import {
  deleteSubscription, listSubscriptions, patchSubscription,
} from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";

export function SubDetails() {
  const { id } = useParams();
  const subId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showConfirm } = useTelegram();

  const { data, isLoading } = useQuery({
    queryKey: ["subs"],
    queryFn: listSubscriptions,
  });
  const sub = data?.subscriptions.find(s => s.id === subId);

  const toggle = useMutation({
    mutationFn: () => patchSubscription(subId, { is_active: !sub?.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subs"] }),
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

  if (isLoading) return <Spinner size="l" />;
  if (!sub) return <div style={{ padding: 32 }}>Topilmadi</div>;

  return (
    <List>
      <Section header={`${sub.dep_name} → ${sub.arr_name}`}>
        <Cell subtitle="Sana">📅 {sub.travel_date}</Cell>
        <Cell subtitle="Poyezd">🚆 {sub.train_number ?? "har qanday"}</Cell>
        <Cell subtitle="Vagon">🪑 {sub.car_types.join(", ") || "barchasi"} · {berthLabel(sub.berth)}</Cell>
        <Cell subtitle="Holat">{sub.is_active ? "🟢 Aktiv" : "⏸ Pauzada"}</Cell>
      </Section>

      <Section header="Statistika">
        <Cell subtitle="Yaratilgan">{new Date(sub.created_at).toLocaleString()}</Cell>
        <Cell subtitle="Yuborilgan xabarlar">{sub.notif_count}</Cell>
        {sub.last_notified_at && (
          <Cell subtitle="Oxirgi xabar">{new Date(sub.last_notified_at).toLocaleString()}</Cell>
        )}
      </Section>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <Button mode="bezeled" stretched onClick={() => toggle.mutate()}
                loading={toggle.isPending}>
          {sub.is_active ? "⏸ Pauza qilish" : "▶️ Davom ettirish"}
        </Button>
        <Button mode="plain" stretched
                onClick={async () => {
                  if (await showConfirm("O'chirishni xohlaysizmi?")) remove.mutate();
                }}
                loading={remove.isPending}>
          🗑 O'chirish
        </Button>
      </div>
    </List>
  );
}

function berthLabel(b: string): string {
  return { lower: "⬇️ pastki", upper: "⬆️ tepa", any: "🟦 har qanday" }[b] || b;
}
