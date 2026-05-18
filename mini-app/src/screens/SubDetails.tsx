import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, List, Section } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import {
  CalendarDays, TrainFront, Armchair, Activity,
  Pause, Play, Trash2, ArrowDownToLine, ArrowUpToLine, Minus,
} from "lucide-react";

import {
  deleteSubscription, listSubscriptions, patchSubscription,
} from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { IconText, StatusView } from "@/ui";

function berthLabel(berth: string) {
  if (berth === "lower") return { Icon: ArrowDownToLine, text: "pastki" };
  if (berth === "upper") return { Icon: ArrowUpToLine, text: "tepa" };
  return { Icon: Minus, text: "har qanday" };
}

export function SubDetails() {
  const { id } = useParams<{ id: string }>();
  const subId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showConfirm } = useTelegram();

  const { data, isLoading } = useQuery({
    queryKey: ["subs"],
    queryFn: listSubscriptions,
  });
  const sub = useMemo(
    () => data?.subscriptions.find(s => s.id === subId),
    [data, subId],
  );

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

  if (isLoading) return <StatusView kind="loading" />;
  if (!sub) {
    return (
      <StatusView
        kind="empty"
        header="Topilmadi"
        description="Bu xabarnoma o'chirilgan yoki mavjud emas."
      />
    );
  }

  const { Icon: BerthIcon, text: berthText } = berthLabel(sub.berth);
  const busy = toggle.isPending || remove.isPending;

  return (
    <List>
      <Section header={`${sub.dep_name} → ${sub.arr_name}`}>
        <Cell subtitle="Sana" before={<CalendarDays size={18} strokeWidth={1.75} />}>
          {sub.travel_date}
        </Cell>
        <Cell subtitle="Poyezd" before={<TrainFront size={18} strokeWidth={1.75} />}>
          {sub.train_number ?? "har qanday"}
        </Cell>
        <Cell subtitle="Vagon" before={<Armchair size={18} strokeWidth={1.75} />}>
          {(sub.car_types.join(", ") || "barchasi")} · <IconText icon={BerthIcon} size={14}>{berthText}</IconText>
        </Cell>
        <Cell subtitle="Holat" before={<Activity size={18} strokeWidth={1.75} />}>
          {sub.is_active ? "Aktiv" : "Pauzada"}
        </Cell>
      </Section>

      <Section header="Statistika">
        <Cell subtitle="Yaratilgan">{new Date(sub.created_at).toLocaleString()}</Cell>
        <Cell subtitle="Yuborilgan xabarlar">{sub.notif_count}</Cell>
        {sub.last_notified_at && (
          <Cell subtitle="Oxirgi xabar">{new Date(sub.last_notified_at).toLocaleString()}</Cell>
        )}
      </Section>

      <Section header="Boshqarish">
        <Cell
          before={
            sub.is_active
              ? <Pause size={20} strokeWidth={1.75} />
              : <Play size={20} strokeWidth={1.75} />
          }
          onClick={busy ? undefined : () => toggle.mutate()}
        >
          {sub.is_active ? "Pauza qilish" : "Davom ettirish"}
        </Cell>
        <Cell
          before={<Trash2 size={20} strokeWidth={1.75} color="var(--tg-danger)" />}
          onClick={busy ? undefined : async () => {
            if (await showConfirm("O'chirishni xohlaysizmi?")) remove.mutate();
          }}
        >
          <span style={{ color: "var(--tg-danger)" }}>O'chirish</span>
        </Cell>
      </Section>
    </List>
  );
}
