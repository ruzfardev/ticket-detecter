import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Train, Clock, CheckCircle2, XCircle, Receipt, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { listOrders, type AutobuyOrder, type AutobuyOrderStatus } from "@/api/client";
import { EmptyNote } from "@/components/EmptyNote";
import { Screen } from "@/components/Screen";
import { Badge } from "@/components/ui/badge";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTile, type TileTone } from "@/components/ui/tile";

type BadgeTone = "outline" | "coral" | "success" | "muted";

const TONE: Record<AutobuyOrderStatus, { badge: BadgeTone; tile: TileTone; text: string; Icon: LucideIcon }> = {
  reserving:    { badge: "outline", tile: "amber", text: "Bron",     Icon: Train },
  awaiting_otp: { badge: "coral",   tile: "coral", text: "OTP",      Icon: KeyRound },
  paying:       { badge: "outline", tile: "amber", text: "To'lov",   Icon: Clock },
  paid:         { badge: "success", tile: "green", text: "To'landi", Icon: CheckCircle2 },
  failed:       { badge: "muted",   tile: "gray",  text: "Xato",     Icon: XCircle },
  expired:      { badge: "muted",   tile: "gray",  text: "Muddat",   Icon: XCircle },
  cancelled:    { badge: "muted",   tile: "gray",  text: "Bekor",    Icon: XCircle },
};

export function Orders() {
  const navigate = useNavigate();
  const ordersQ = useQuery({ queryKey: ["orders"], queryFn: listOrders });

  if (ordersQ.isLoading) {
    return (
      <Screen tabbed padded title="Buyurtmalar" reveal={false}>
        <div className="space-y-px overflow-hidden rounded-[26px]">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-[66px] rounded-none" />)}
        </div>
      </Screen>
    );
  }

  const orders = ordersQ.data ?? [];
  if (orders.length === 0) {
    return (
      <Screen tabbed padded title="Buyurtmalar">
        <EmptyNote
          icon={Receipt}
          title="Buyurtmalar yo'q"
          body="Auto-buy yoqilganda chiptalar bu yerda paydo bo'ladi."
        />
      </Screen>
    );
  }

  const active = orders.filter(o => ["reserving","awaiting_otp","paying"].includes(o.status));
  const done   = orders.filter(o => !active.includes(o));

  const row = (o: AutobuyOrder) => {
    const meta = TONE[o.status];
    const seats = o.seat_numbers?.length ? o.seat_numbers : [o.seat_number];
    return (
      <ListRow
        key={o.id}
        before={<IconTile icon={meta.Icon} tone={meta.tile} />}
        title={`${o.train_number} · Vagon ${o.car_number} · ${seats.length > 1 ? `Joylar ${seats.join(", ")}` : `Joy ${seats[0]}`}`}
        subtitle={`${o.travel_date}${o.amount_uzs ? ` · ${o.amount_uzs.toLocaleString("ru-RU")} so'm` : ""}`}
        after={<Badge variant={meta.badge}>{meta.text}</Badge>}
        onClick={() => navigate(`/order/${o.id}`)}
      />
    );
  };

  return (
    <Screen tabbed padded title="Buyurtmalar">
      {active.length > 0 && (
        <ListGroup label="Faol">{active.map(row)}</ListGroup>
      )}
      {done.length > 0 && (
        <ListGroup label="Tugagan">{done.map(row)}</ListGroup>
      )}
    </Screen>
  );
}
