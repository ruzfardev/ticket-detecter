import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Train, Clock, CheckCircle2, XCircle } from "lucide-react";

import { listOrders, type AutobuyOrder, type AutobuyOrderStatus } from "@/api/client";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Badge } from "@/components/ui/badge";
import { ListGroup, ListRow } from "@/components/ui/list";

const TONE: Record<AutobuyOrderStatus, {tone: "outline"|"coral"|"success"|"muted"; text: string; Icon: typeof Clock}> = {
  reserving:    { tone: "outline", text: "Bron",     Icon: Train },
  awaiting_otp: { tone: "coral",   text: "OTP",      Icon: Clock },
  paying:       { tone: "outline", text: "To'lov",   Icon: Clock },
  paid:         { tone: "success", text: "To'landi", Icon: CheckCircle2 },
  failed:       { tone: "muted",   text: "Xato",     Icon: XCircle },
  expired:      { tone: "muted",   text: "Muddat",   Icon: XCircle },
  cancelled:    { tone: "muted",   text: "Bekor",    Icon: XCircle },
};

export function Orders() {
  const navigate = useNavigate();
  const ordersQ = useQuery({ queryKey: ["orders"], queryFn: listOrders });

  if (ordersQ.isLoading) return <StatusView kind="loading" />;
  const orders = ordersQ.data ?? [];
  if (orders.length === 0) {
    return (
      <StatusView
        kind="empty"
        header="Buyurtmalar yo'q"
        description="Auto-buy yoqilganda chiptalar bu yerda paydo bo'ladi."
      />
    );
  }

  const active = orders.filter(o => ["reserving","awaiting_otp","paying"].includes(o.status));
  const done   = orders.filter(o => !active.includes(o));

  const row = (o: AutobuyOrder) => {
    const meta = TONE[o.status];
    const Icon = meta.Icon;
    const seats = o.seat_numbers?.length ? o.seat_numbers : [o.seat_number];
    return (
      <ListRow
        key={o.id}
        before={<Icon className={`h-5 w-5 ${o.status === "awaiting_otp" ? "text-coral" : "text-ink"}`} strokeWidth={1.75} />}
        title={`${o.train_number} · Vagon ${o.car_number} · ${seats.length > 1 ? `Joylar ${seats.join(", ")}` : `Joy ${seats[0]}`}`}
        subtitle={`${o.travel_date}${o.amount_uzs ? ` · ${o.amount_uzs.toLocaleString("ru-RU")} so'm` : ""}`}
        after={<Badge variant={meta.tone}>{meta.text}</Badge>}
        chevron
        onClick={() => navigate(`/order/${o.id}`)}
      />
    );
  };

  return (
    <Screen padded title="Buyurtmalar">
      {active.length > 0 && (
        <ListGroup label="Faol">{active.map(row)}</ListGroup>
      )}
      {done.length > 0 && (
        <ListGroup label="Tugagan">{done.map(row)}</ListGroup>
      )}
    </Screen>
  );
}
