import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Armchair, CalendarDays, FileDown, Link2, Ticket as TicketIcon, TrainFront,
} from "lucide-react";

import {
  getTicketDetail, listTickets, sendTicketPdf,
  type PurchasedTicket,
} from "@/api/client";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Spinner } from "@/components/ui/spinner";
import { dayOffset, trainTime } from "@/lib/traintime";

/** eticket sends "2026-10-15 17:20:00" — Tashkent wall clock, no offset. */
function dateOf(raw: string): string {
  return (raw ?? "").slice(0, 10);
}
function hhmm(raw: string): string {
  return trainTime((raw ?? "").replace(" ", "T"));
}

/** A returned ticket still sits under a COMPLETED order, so status is per-ticket. */
const TICKET_STATUS: Record<string, { text: string; tone: "success" | "muted" | "coral" }> = {
  SoldTicket:     { text: "Amal qiladi",  tone: "success" },
  ReturnedTicket: { text: "Qaytarilgan",  tone: "muted" },
};

function TicketCard({ t }: { t: PurchasedTicket }) {
  const [open, setOpen] = useState(false);

  const detail = useQuery({
    queryKey: ["ticketDetail", t.order_item_id],
    queryFn: () => getTicketDetail(t.order_item_id, t.created_at),
    enabled: open,
  });

  const send = useMutation({
    mutationFn: () => sendTicketPdf(t.order_item_id, t.created_at),
    onSuccess: () => toast.success("PDF botga yuborildi — chatni oching"),
    onError: () => toast.error("PDF yuborib bo'lmadi"),
  });

  const plus = dayOffset(
    t.dep_at.replace(" ", "T"),
    t.arr_at.replace(" ", "T"),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface-card">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full space-y-3 p-4 text-left transition-colors active:bg-surface-cream-strong"
      >
        <div className="flex items-center gap-2">
          <TrainFront className="h-4 w-4 text-muted" strokeWidth={1.75} />
          <span className="font-display text-display-sm text-ink">{t.train_number}</span>
          <span className="ml-auto text-body-sm tabular-nums text-muted">
            {t.amount_uzs.toLocaleString("ru-RU").replace(/ /g, " ")} so'm
          </span>
        </div>

        <div className="flex items-end gap-2">
          <div className="min-w-0">
            <div className="truncate text-caption-upper uppercase text-muted">
              {t.dep_station}
            </div>
            <div className="font-display text-display-sm tabular-nums text-coral">
              {hhmm(t.dep_at)}
            </div>
          </div>
          <div className="flex-1 border-t border-dashed border-hairline pb-2" />
          <div className="min-w-0 text-right">
            <div className="truncate text-caption-upper uppercase text-muted">
              {t.arr_station}
            </div>
            <div className="font-display text-display-sm tabular-nums text-coral">
              {hhmm(t.arr_at)}
              {plus > 0 && <sup className="ml-0.5 text-caption text-muted">+{plus}</sup>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline-soft pt-3 text-body-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
            {dateOf(t.dep_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Armchair className="h-3.5 w-3.5" strokeWidth={1.75} />
            Vagon {t.car_number} · joy {t.seats.join(", ") || "—"}
          </span>
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-hairline-soft px-4 pb-4 pt-3">
          {detail.isLoading && (
            <div className="flex justify-center py-2"><Spinner size="sm" /></div>
          )}
          {detail.data?.tickets.map(d => {
            const s = TICKET_STATUS[d.status] ?? { text: d.status, tone: "muted" as const };
            return (
              <div key={d.ticket_id} className="flex items-center gap-2 text-body-sm">
                <span className="min-w-0 flex-1 truncate text-ink">
                  {d.passenger_name || "—"}
                </span>
                <span className="text-muted">joy {d.seat_number}</span>
                <Badge variant={s.tone}>{s.text}</Badge>
              </div>
            );
          })}
          {detail.isError && (
            <p className="text-body-sm text-muted">Tafsilotni yuklab bo'lmadi.</p>
          )}

          <Button
            full
            variant="secondary"
            disabled={send.isPending}
            onClick={() => send.mutate()}
          >
            <FileDown size={16} strokeWidth={1.75} />
            {send.isPending ? "Yuborilmoqda…" : "PDF ni botga yuborish"}
          </Button>
          <p className="text-center text-body-sm text-muted">
            Chipta chatga fayl bo'lib tushadi — saqlash va chop etish oson.
          </p>
        </div>
      )}
    </div>
  );
}

export function Tickets() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["tickets"], queryFn: listTickets, retry: false });

  if (q.isLoading) return <StatusView kind="loading" />;

  if (q.isError) {
    const code = (q.error as any)?.response?.data?.error?.code;
    if (code === "railway_account_required") {
      return (
        <StatusView
          kind="empty"
          header="Akkount ulanmagan"
          description="Chiptalaringizni ko'rish uchun eticket.railway.uz akkountingizni ulang."
          action={<Button onClick={() => navigate("/railway-link")}>
            <Link2 size={16} strokeWidth={1.75} />
            Akkountni ulash
          </Button>}
        />
      );
    }
    return <StatusView kind="error" description="Chiptalarni yuklab bo'lmadi." />;
  }

  const tickets = q.data ?? [];
  if (tickets.length === 0) {
    return (
      <StatusView
        kind="empty"
        header="Chipta yo'q"
        description="eticket akkountingizda sotib olingan chipta topilmadi."
      />
    );
  }

  return (
    <Screen padded title="Chiptalarim" subtitle={`${tickets.length} ta`}>
      <ListGroup label="eticket akkountingizdan" footer="Bot orqali sotib olinmagan chiptalar ham shu yerda ko'rinadi.">
        <ListRow
          before={<TicketIcon className="h-5 w-5 text-coral" strokeWidth={1.75} />}
          title="Tafsilot uchun chiptani bosing"
          subtitle="Yo'lovchi, holati va PDF"
        />
      </ListGroup>

      <div className="space-y-2">
        {tickets.map(t => <TicketCard key={t.order_item_id} t={t} />)}
      </div>
    </Screen>
  );
}
