import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Armchair, CalendarDays, ChevronLeft, ChevronRight, FileDown, Link2, TrainFront,
} from "lucide-react";

import {
  listArchivedTickets, listTickets, sendTicketPdf,
  type PurchasedTicket,
} from "@/api/client";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHaptic } from "@/hooks/useHaptic";
import { formatMonth, shiftMonth, tashkentMonth } from "@/lib/dates";
import { dayOffset, trainTime } from "@/lib/traintime";
import { cn } from "@/lib/utils";

/** eticket sends "2026-10-15 17:20:00" — Tashkent wall clock, no offset. */
function dateOf(raw: string): string {
  return (raw ?? "").slice(0, 10);
}
function hhmm(raw: string): string {
  return trainTime((raw ?? "").replace(" ", "T"));
}

/**
 * Per-ticket status. Independent of the order's status — a returned ticket
 * still sits under an ORDER_COMPLETED_SUCCESSFULLY order.
 *
 * Values taken from eticket's own bundle, plus `ReturnedTicket`, which the live
 * API returns even though the bundle spells it `ReturnTicket`.
 */
type Tone = "success" | "muted" | "coral";

const TICKET_STATUS: Record<string, { text: string; tone: Tone }> = {
  ConfirmedTicket:   { text: "Amal qiladi",     tone: "success" },
  ReservedTicket:    { text: "Bron qilingan",   tone: "coral"   },
  UnconfirmedTicket: { text: "Tasdiqlanmagan",  tone: "coral"   },
  NotPayedTicket:    { text: "To'lanmagan",     tone: "coral"   },
  ReturnTicket:      { text: "Qaytarilgan",     tone: "muted"   },
  ReturnedTicket:    { text: "Qaytarilgan",     tone: "muted"   },
  UsedTicket:        { text: "Foydalanilgan",   tone: "muted"   },
  ExpiredTicket:     { text: "Muddati o'tgan",  tone: "muted"   },
  DelayedTicket:     { text: "Kechiktirilgan",  tone: "muted"   },
  PaperTicket:       { text: "Qog'oz chipta",   tone: "muted"   },
};

/** Unknown value: drop the "Ticket" suffix and space out the camelCase, so a
 *  status we have not seen still reads as words rather than "ConfirmedTicket". */
function statusOf(raw: string): { text: string; tone: Tone } {
  const known = TICKET_STATUS[raw];
  if (known) return known;
  const text = (raw ?? "")
    .replace(/Ticket$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return { text: text || "—", tone: "muted" };
}

function TicketCard({ t }: { t: PurchasedTicket }) {
  const [open, setOpen] = useState(false);

  const send = useMutation({
    mutationFn: () => sendTicketPdf(t.order_item_id, t.created_at, t.archived),
    onSuccess: () => toast.success("PDF botga yuborildi — chatni oching"),
    onError: () => toast.error("PDF yuborib bo'lmadi"),
  });

  const plus = dayOffset(
    t.dep_at.replace(" ", "T"),
    t.arr_at.replace(" ", "T"),
  );
  const timeTone = t.returned ? "text-muted" : "text-coral";

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
          {t.returned && <Badge variant="muted">Qaytarilgan</Badge>}
          <span className="ml-auto text-body-sm tabular-nums text-muted">
            {t.amount_uzs.toLocaleString("ru-RU").replace(/ /g, " ")} so'm
          </span>
        </div>

        <div className="flex items-end gap-2">
          <div className="min-w-0">
            <div className="truncate text-caption-upper uppercase text-muted">
              {t.dep_station}
            </div>
            <div className={cn("font-display text-display-sm tabular-nums", timeTone)}>
              {hhmm(t.dep_at)}
            </div>
          </div>
          <div className="flex-1 border-t border-dashed border-hairline pb-2" />
          <div className="min-w-0 text-right">
            <div className="truncate text-caption-upper uppercase text-muted">
              {t.arr_station}
            </div>
            <div className={cn("font-display text-display-sm tabular-nums", timeTone)}>
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
          {t.tickets.map(d => {
            const s = statusOf(d.status);
            return (
              <div key={d.ticket_id || d.seat} className="flex items-center gap-2 text-body-sm">
                <span className="min-w-0 flex-1 truncate text-ink">
                  {d.passenger_name || "—"}
                </span>
                <span className="text-muted">joy {d.seat}</span>
                <Badge variant={s.tone}>{s.text}</Badge>
              </div>
            );
          })}
          {!t.status_known && (
            <p className="text-body-sm text-muted">Yo'lovchi va holatni yuklab bo'lmadi.</p>
          )}

          {!t.returned && (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Kelgusi / O'tgan / Qaytarilgan ──────────────────────────────────── */

type Leg = "upcoming" | "past" | "returned";

function byDeparture(dir: 1 | -1) {
  return (a: PurchasedTicket, b: PurchasedTicket) =>
    a.dep_at < b.dep_at ? -dir : a.dep_at > b.dep_at ? dir : 0;
}

function TabCount({ n }: { n: number }) {
  return <span className="tabular-nums opacity-60">{n}</span>;
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-hairline px-4 py-8 text-center">
      <p className="text-title-sm text-ink">{title}</p>
      <p className="mt-1 text-body-sm text-muted">{body}</p>
    </div>
  );
}

function Cards({ tickets }: { tickets: PurchasedTicket[] }) {
  return (
    <div className="space-y-2">
      {tickets.map(t => <TicketCard key={t.order_item_id} t={t} />)}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="px-1 text-caption-upper uppercase text-muted">{children}</div>;
}

const STEP_BTN =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-ink " +
  "transition-colors active:bg-surface-cream-strong disabled:opacity-30 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40";

/** ‹ Avgust 2026 › — never past the current month. */
function MonthStepper({
  month, onMonth, caption,
}: { month: string; onMonth: (m: string) => void; caption: string }) {
  const haptic = useHaptic();
  const thisMonth = tashkentMonth();
  const step = (delta: -1 | 1) => {
    haptic.selection();
    onMonth(shiftMonth(month, delta));
  };
  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface-card px-2 py-1.5">
      <button type="button" aria-label="Oldingi oy" className={STEP_BTN} onClick={() => step(-1)}>
        <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
      </button>
      <div className="min-w-0 text-center">
        <div className="text-title-sm text-ink">{formatMonth(month)}</div>
        <div className="text-caption text-muted">{caption}</div>
      </div>
      <button
        type="button"
        aria-label="Keyingi oy"
        className={STEP_BTN}
        disabled={month >= thisMonth}
        onClick={() => step(1)}
      >
        <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

const ARCHIVE_EMPTY: Record<"past" | "returned", { title: string; body: string }> = {
  past:     { title: "Bu oyda xarid qilingan safar yo'q", body: "Oldingi oylarni ‹ bilan varaqlang." },
  returned: { title: "Bu oyda qaytarilgan chipta yo'q",   body: "Oldingi oylarni ‹ bilan varaqlang." },
};

/**
 * One month of eticket's archive — the month a ticket was BOUGHT, which is
 * how eticket files it — narrowed to trips travelled or trips returned.
 * Most recent departure first.
 */
function ArchivePanel({
  month, onMonth, show,
}: { month: string; onMonth: (m: string) => void; show: "past" | "returned" }) {
  const q = useQuery({
    queryKey: ["ticketsArchive", month],
    queryFn: () => listArchivedTickets(month),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const tickets = useMemo(
    () => (q.data ?? [])
      .filter(t => t.returned === (show === "returned"))
      .sort(byDeparture(-1)),
    [q.data, show],
  );
  const caption = q.isFetching ? "Yuklanmoqda…"
    : q.isError ? "Yuklab bo'lmadi"
    : `shu oyda xarid qilingan · ${tickets.length} ta`;

  return (
    <div className="space-y-3">
      <MonthStepper month={month} onMonth={onMonth} caption={caption} />
      {q.isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : q.isError ? (
        <Note title="Arxivni yuklab bo'lmadi" body="Birozdan so'ng qayta urinib ko'ring." />
      ) : tickets.length === 0 ? (
        <Note {...ARCHIVE_EMPTY[show]} />
      ) : (
        <Cards tickets={tickets} />
      )}
    </div>
  );
}

export function Tickets() {
  const navigate = useNavigate();
  const haptic = useHaptic();
  const q = useQuery({ queryKey: ["tickets"], queryFn: listTickets, retry: false });
  const [picked, setPicked] = useState<Leg | null>(null);
  const [month, setMonth] = useState(tashkentMonth);

  // eticket's active list is upcoming travel, returned tickets included until
  // their travel date. Split them out; next trip first.
  const upcoming = useMemo(
    () => (q.data ?? []).filter(t => !t.returned).sort(byDeparture(1)),
    [q.data],
  );
  const upcomingReturned = useMemo(
    () => (q.data ?? []).filter(t => t.returned).sort(byDeparture(1)),
    [q.data],
  );

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

  // Open on the next trip. With none, on whatever is most worth knowing: a
  // returned upcoming ticket, else the archive.
  const leg: Leg = picked
    ?? (upcoming.length > 0 ? "upcoming"
      : upcomingReturned.length > 0 ? "returned"
      : "past");

  return (
    <Screen padded title="Chiptalarim">
      <Tabs
        value={leg}
        onValueChange={v => { haptic.selection(); setPicked(v as Leg); }}
      >
        <TabsList aria-label="Chiptalar bo'yicha">
          <TabsTrigger value="upcoming">
            Kelgusi <TabCount n={upcoming.length} />
          </TabsTrigger>
          <TabsTrigger value="past">O'tgan</TabsTrigger>
          <TabsTrigger value="returned">Qaytarilgan</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-3">
          {upcoming.length === 0 ? (
            <Note title="Kelgusi safar yo'q" body="Yangi chipta sotib olinganda shu yerda ko'rinadi." />
          ) : (
            <Cards tickets={upcoming} />
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-3">
          <ArchivePanel month={month} onMonth={setMonth} show="past" />
        </TabsContent>

        {/* Returned tickets have no list of their own on eticket: the ones
            with a future date still sit in the active list, the rest in the
            archive under the month they were bought. Both, in that order. */}
        <TabsContent value="returned" className="mt-3">
          <div className="space-y-5">
            {upcomingReturned.length > 0 && (
              <div className="space-y-2">
                <SectionLabel>Kelgusi sanaga</SectionLabel>
                <Cards tickets={upcomingReturned} />
              </div>
            )}
            <div className="space-y-2">
              <SectionLabel>Arxiv</SectionLabel>
              <ArchivePanel month={month} onMonth={setMonth} show="returned" />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Screen>
  );
}
