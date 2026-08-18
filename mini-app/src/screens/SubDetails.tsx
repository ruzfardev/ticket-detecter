import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays, TrainFront, Armchair, Activity,
  Pause, Play, Trash2, ArrowDownToLine, ArrowUpToLine, Minus,
  Zap,
} from "lucide-react";

import {
  deleteSubscription, listSubscriptions, patchSubscription,
} from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Badge } from "@/components/ui/badge";
import { ListGroup, ListRow } from "@/components/ui/list";

function berth(b: string) {
  if (b === "lower") return { Icon: ArrowDownToLine, text: "pastki" };
  if (b === "upper") return { Icon: ArrowUpToLine, text: "tepa" };
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

  const { Icon: BerthIcon, text: berthText } = berth(sub.berth);
  const busy = toggle.isPending || remove.isPending;

  return (
    <Screen
      padded
      title={`${sub.dep_name} → ${sub.arr_name}`}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <Badge variant={sub.is_active ? "success" : "muted"}>
            {sub.is_active ? "Aktiv" : "Pauzada"}
          </Badge>
        </span>
      }
    >
      <ListGroup label="Tafsilotlar">
        <ListRow
          before={<CalendarDays className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={sub.travel_date}
          subtitle="Sana"
        />
        <ListRow
          before={<TrainFront className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={sub.train_numbers.length ? sub.train_numbers.join(", ") : "Har qanday"}
          subtitle={sub.train_numbers.length > 1 ? `Poyezdlar · ${sub.train_numbers.length} ta` : "Poyezd"}
        />
        <ListRow
          before={<Armchair className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={sub.car_types.join(", ") || "Barchasi"}
          subtitle="Vagon turi"
        />
        <ListRow
          before={<BerthIcon className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={berthText}
          subtitle="Joy turi"
        />
        <ListRow
          before={<Activity className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={sub.is_active ? "Aktiv" : "Pauzada"}
          subtitle="Holat"
        />
      </ListGroup>

      <ListGroup
        label="Avto sotib olish"
        footer={
          sub.autobuy_enabled
            ? "Chipta topilganda avtomatik bron qilinadi — sizga faqat SMS kod kerak bo'ladi"
            : "Yoqilsa, chipta topilgan paytda avtomatik bron qilinadi"
        }
      >
        <ListRow
          before={
            <Zap
              className={`h-5 w-5 ${sub.autobuy_enabled ? "text-coral" : "text-muted-soft"}`}
              strokeWidth={1.75}
            />
          }
          title={sub.autobuy_enabled ? "Yoqilgan" : "O'chirilgan"}
          subtitle={
            sub.autobuy_enabled
              ? sub.autobuy_friend_name
                ? `Hamroh: ${sub.autobuy_friend_name}`
                : "Hamroh tanlanmagan"
              : "Sozlash uchun bosing"
          }
          after={
            sub.autobuy_enabled ? (
              <Badge variant="coral">Faol</Badge>
            ) : undefined
          }
          onClick={() => navigate(`/sub/${subId}/autobuy`)}
          chevron
        />
      </ListGroup>

      <ListGroup label="Statistika">
        <ListRow
          title={new Date(sub.created_at).toLocaleString()}
          subtitle="Yaratilgan"
        />
        <ListRow
          title={sub.notif_count.toString()}
          subtitle="Yuborilgan xabarlar"
        />
        {sub.last_notified_at && (
          <ListRow
            title={new Date(sub.last_notified_at).toLocaleString()}
            subtitle="Oxirgi xabar"
          />
        )}
      </ListGroup>

      <ListGroup label="Boshqarish">
        <ListRow
          before={
            sub.is_active ? (
              <Pause className="h-5 w-5 text-ink" strokeWidth={1.75} />
            ) : (
              <Play className="h-5 w-5 text-ink" strokeWidth={1.75} />
            )
          }
          title={sub.is_active ? "Pauza qilish" : "Davom ettirish"}
          disabled={busy}
          onClick={() => toggle.mutate()}
        />
        <ListRow
          before={<Trash2 className="h-5 w-5 text-error" strokeWidth={1.75} />}
          title="O'chirish"
          destructive
          disabled={busy}
          onClick={async () => {
            if (await showConfirm("O'chirishni xohlaysizmi?")) remove.mutate();
          }}
        />
      </ListGroup>
    </Screen>
  );
}
