import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronDown, ChevronLeft, ChevronRight, FileDown, Link2, TrainFront,
} from "lucide-react";

import {
  isReservedLeg, listArchivedTickets, listTickets, sendTicketPdf,
  type PurchasedTicket,
} from "@/api/client";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHaptic } from "@/hooks/useHaptic";
import { formatMonth, formatTravelDate, shiftMonth, tashkentMonth } from "@/lib/dates";
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
  // eticket's literal status on an unpaid reservation
  None:              { text: "To'lanmagan",     tone: "coral"   },
  ReservedTicket:    { text: "Bron qilingan",   tone: "coral"   },
  UnconfirmedTicket: { text: "Tasdiqlanmagan",  tone: "coral"   },
  NotPayedTicket:    { text: "To'lanmagan",     tone: "coral"   },
  ReturnTicket:      { text: "Qaytarilgan",     tone: "muted"   },
  ReturnedTicket:    { text: "Qaytarilgan",     tone: "muted"   },
  UsedTicket:        { text: "Foydalanilgan",   tone: "muted"   },
  ExpiredTicket:     { text: "Muddati o'tgan",  tone: "muted"   },
  DelayedTicket:     { text: "Kechiktirilgan",  tone: "muted"   },
  PaperTicket:       { text: "Qog'oz chipta",   tone: "muted"   },
  // The v3 order system (orders since late September 2026) speaks upper case.
  CONFIRMED:         { text: "Amal qiladi",     tone: "success" },
  PAID:              { text: "Amal qiladi",     tone: "success" },
  RETURNED:          { text: "Qaytarilgan",     tone: "muted"   },
  RETURN_SUCCEEDED:  { text: "Qaytarilgan",     tone: "muted"   },
  REFUNDED:          { text: "Qaytarilgan",     tone: "muted"   },
  USED:              { text: "Foydalanilgan",   tone: "muted"   },
  EXPIRED:           { text: "Muddati o'tgan",  tone: "muted"   },
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
  // The collapsed body stays mounted so its height can animate; `inert`
  // keeps its button out of tab order and screen readers meanwhile.
  // (React 18 has no typed `inert` prop, hence the attribute toggle.)
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.toggleAttribute("inert", !open); }, [open]);

  const send = useMutation({
    mutationFn: () => sendTicketPdf(t),
    onSuccess: () => toast.success("PDF botga yuborildi — chatni oching"),
    onError: () => toast.error("PDF yuborib bo'lmadi"),
  });

  const plus = dayOffset(
    t.dep_at.replace(" ", "T"),
    t.arr_at.replace(" ", "T"),
  );
  const reserved = isReservedLeg(t);
  const timeTone = t.returned ? "text-muted" : "text-ink";
  const seats = t.seats.join(", ") || "—";

  return (
    // A boarding pass: the journey on top, a perforated tear line with two
    // notches, and a stub with the facts a conductor asks for.
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-hairline-soft bg-surface-card",
        t.returned && "opacity-70 saturate-50",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="block w-full text-left transition-colors active:bg-surface-cream-strong"
      >
        <div className="space-y-4 p-4 pb-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-coral/10 text-coral">
              <TrainFront className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="font-display text-display-sm text-ink">{t.train_number}</span>
            {t.returned && <Badge variant="muted">Qaytarilgan</Badge>}
            {reserved && <Badge variant="coral">Bron</Badge>}
            <span className="ml-auto text-body-sm tabular-nums text-muted">
              {t.amount_uzs.toLocaleString("ru-RU").replace(/ /g, " ")} so'm
            </span>
          </div>

          <div className="flex items-end gap-3">
            <div className="min-w-0">
              <div className={cn("font-display text-display-lg tabular-nums leading-none", timeTone)}>
                {hhmm(t.dep_at)}
              </div>
              <div className="mt-1.5 truncate text-caption-upper uppercase text-muted">
                {t.dep_station}
              </div>
            </div>
            {/* the track, with the train riding it */}
            <div className="relative mb-6 flex-1">
              <div className="border-t-2 border-dotted border-hairline" />
              <span className="ticket-train absolute -top-[9px] left-1/2 -translate-x-1/2 rounded-pill bg-surface-card px-1 text-coral">
                <TrainFront className="h-4 w-4" strokeWidth={2} />
              </span>
            </div>
            <div className="min-w-0 text-right">
              <div className={cn("font-display text-display-lg tabular-nums leading-none", timeTone)}>
                {hhmm(t.arr_at)}
                {plus > 0 && <sup className="ml-0.5 text-caption text-muted">+{plus}</sup>}
              </div>
              <div className="mt-1.5 truncate text-caption-upper uppercase text-muted">
                {t.arr_station}
              </div>
            </div>
          </div>
        </div>

        {/* tear line: dashes between two notches cut out of the card's edges */}
        <div aria-hidden className="relative h-0">
          <span className="absolute -left-[11px] -top-[11px] h-[22px] w-[22px] rounded-pill border border-hairline-soft bg-canvas" />
          <span className="absolute -right-[11px] -top-[11px] h-[22px] w-[22px] rounded-pill border border-hairline-soft bg-canvas" />
          <div className="mx-5 border-t-2 border-dashed border-hairline" />
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-x-5 px-4 pb-4 pt-5">
          <div className="min-w-0">
            <div className="text-caption-upper uppercase text-muted">Sana</div>
            <div className="mt-0.5 truncate text-title-sm text-ink">{formatTravelDate(dateOf(t.dep_at))}</div>
          </div>
          <div>
            <div className="text-caption-upper uppercase text-muted">Vagon</div>
            <div className="mt-0.5 text-title-sm tabular-nums text-ink">{t.car_number}</div>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <div className="text-caption-upper uppercase text-muted">Joy</div>
              <div className="mt-0.5 text-title-sm tabular-nums text-ink">{seats}</div>
            </div>
            <ChevronDown
              className={cn(
                "mb-0.5 h-4 w-4 text-muted transition-transform duration-300",
                open && "rotate-180",
              )}
              strokeWidth={1.75}
            />
          </div>
        </div>
      </button>

      {/* Height animates via grid rows 0fr→1fr — no measuring, no layout jank. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
       <div ref={bodyRef} className="min-h-0 overflow-hidden">
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

          {reserved && (
            <p className="text-body-sm text-muted">
              Bron to'lanmagan. To'lov o'tgach chipta shu yerda amal qiladi.
            </p>
          )}
          {!t.returned && !reserved && (
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
       </div>
      </div>
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
