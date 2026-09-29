import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import {
  Armchair, CalendarDays, ChevronLeft, ChevronRight, FileDown, Link2, TrainFront,
  Ticket as TicketIcon, Archive, Undo2,
} from "lucide-react";

import {
  isReservedLeg, listArchivedTickets, listTickets, sendTicketPdf,
  type PurchasedTicket,
} from "@/api/client";
import { EmptyNote } from "@/components/EmptyNote";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { TicketShell } from "@/components/trip/TicketShell";
import { TripTimes } from "@/components/trip/TripTimes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { PressCard } from "@/components/ui/press-card";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHaptic } from "@/hooks/useHaptic";
import { formatMonth, shiftMonth, tashkentMonth } from "@/lib/dates";
import { spring } from "@/lib/motion";
import { dayOffset, trainTime } from "@/lib/traintime";

/**
 * Per-ticket status. Independent of the order's status — a returned ticket
 * still sits under an ORDER_COMPLETED_SUCCESSFULLY order.
 *
 * Values taken from eticket's own bundle, plus `ReturnedTicket`, which the live
 * API returns even though the bundle spells it `ReturnTicket`. The v3 order
 * system (orders since late September 2026) speaks upper case.
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
  CONFIRMED:         { text: "Amal qiladi",     tone: "success" },
  PAID:              { text: "Amal qiladi",     tone: "success" },
  RETURNED:          { text: "Qaytarilgan",     tone: "muted"   },
  RETURN_SUCCEEDED:  { text: "Qaytarilgan",     tone: "muted"   },
  REFUNDED:          { text: "Qaytarilgan",     tone: "muted"   },
  USED:              { text: "Foydalanilgan",   tone: "muted"   },
  EXPIRED:           { text: "Muddati o'tgan",  tone: "muted"   },
};

/** eticket sends "2026-10-15 17:20:00" — Tashkent wall clock, no offset. */
function dateOf(raw: string): string {
  return (raw ?? "").slice(0, 10);
}
function hhmm(raw: string): string {
  return trainTime((raw ?? "").replace(" ", "T"));
}
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
const som = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ");

/* ── One ticket ──────────────────────────────────────────────────────── */

function TicketCard({ t, onOpen }: { t: PurchasedTicket; onOpen: () => void }) {
  const plus = dayOffset(t.dep_at.replace(" ", "T"), t.arr_at.replace(" ", "T"));
  const reserved = isReservedLeg(t);

  return (
    <PressCard
      material="none"
      onClick={onOpen}
      className="rounded-[26px]"
      aria-label={`${t.train_number}, ${t.dep_station} — ${t.arr_station}, ${dateOf(t.dep_at)}`}
    >
      <TicketShell
        top={
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <TrainFront className="size-[18px] text-muted" strokeWidth={2} />
              <span className="font-display text-title-lg text-ink">{t.train_number}</span>
              {t.returned && <Badge variant="muted">Qaytarilgan</Badge>}
              {reserved && <Badge variant="coral">Bron</Badge>}
              <span className="tnum ml-auto text-body-sm text-muted">{som(t.amount_uzs)} so'm</span>
            </div>
            <TripTimes
              tone={t.returned ? "muted" : "ink"}
              dep={{ station: t.dep_station, time: hhmm(t.dep_at) }}
              arr={{ station: t.arr_station, time: hhmm(t.arr_at), plus }}
            />
          </div>
        }
        bottom={
          <div className="flex items-center gap-x-4 gap-y-1 text-body-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" strokeWidth={1.9} />
              {dateOf(t.dep_at)}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
              <Armchair className="size-4 shrink-0" strokeWidth={1.9} />
              Vagon {t.car_number} · joy {t.seats.join(", ") || "—"}
            </span>
            <ChevronRight className="ml-auto size-[18px] shrink-0 text-muted-soft" strokeWidth={2.2} />
          </div>
        }
      />
    </PressCard>
  );
}

/** Everything about one ticket, in a sheet: who travels, their status, the PDF. */
function TicketSheet({
  leg, open, onOpenChange,
}: { leg: PurchasedTicket | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const haptic = useHaptic();
  const send = useMutation({
    mutationFn: (t: PurchasedTicket) => sendTicketPdf(t),
    onSuccess: () => { haptic.notify("success"); toast.success("PDF botga yuborildi — chatni oching"); },
    onError: () => { haptic.notify("error"); toast.error("PDF yuborib bo'lmadi"); },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {leg && (
          <div className="space-y-5 pb-1">
            <div>
              <SheetTitle>{leg.train_number} · {dateOf(leg.dep_at)}</SheetTitle>
              <SheetDescription>Vagon {leg.car_number} · joy {leg.seats.join(", ") || "—"}</SheetDescription>
            </div>

            <TripTimes
              tone={leg.returned ? "muted" : "coral"}
              moving={!leg.returned}
              dep={{ station: leg.dep_station, time: hhmm(leg.dep_at) }}
              arr={{
                station: leg.arr_station,
                time: hhmm(leg.arr_at),
                plus: dayOffset(leg.dep_at.replace(" ", "T"), leg.arr_at.replace(" ", "T")),
              }}
            />

            <ListGroup label={leg.tickets.length > 1 ? `Yo'lovchilar · ${leg.tickets.length} ta` : "Yo'lovchi"}>
              {leg.tickets.length === 0 ? (
                <ListRow title="—" subtitle={leg.status_known ? undefined : "Yo'lovchi va holatni yuklab bo'lmadi."} />
              ) : (
                leg.tickets.map(d => {
                  const s = statusOf(d.status);
                  return (
                    <ListRow
                      key={d.ticket_id || d.seat}
                      title={d.passenger_name || "—"}
                      subtitle={`joy ${d.seat}`}
                      after={<Badge variant={s.tone}>{s.text}</Badge>}
                    />
                  );
                })
              )}
            </ListGroup>

            {isReservedLeg(leg) && (
              <p className="px-1 text-body-sm text-muted">
                Bron to'lanmagan. To'lov o'tgach chipta shu yerda amal qiladi.
              </p>
            )}
            {!leg.returned && !isReservedLeg(leg) && (
              <div className="space-y-2.5">
                <Button full loading={send.isPending} onClick={() => send.mutate(leg)}>
                  {!send.isPending && <FileDown strokeWidth={2.2} />}
                  {send.isPending ? "Yuborilmoqda…" : "PDF ni botga yuborish"}
                </Button>
                <p className="text-center text-caption text-muted">
                  Chipta chatga fayl bo'lib tushadi — saqlash va chop etish oson.
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── Kelgusi / O'tgan / Qaytarilgan ──────────────────────────────────── */

type Leg = "upcoming" | "past" | "returned";

function byDeparture(dir: 1 | -1) {
  return (a: PurchasedTicket, b: PurchasedTicket) =>
    a.dep_at < b.dep_at ? -dir : a.dep_at > b.dep_at ? dir : 0;
}

function TabCount({ n }: { n: number }) {
  return <span className="tnum opacity-60">{n}</span>;
}

/** Tickets arrive one after another, a beat apart. */
function Cards({ tickets, onOpen }: { tickets: PurchasedTicket[]; onOpen: (t: PurchasedTicket) => void }) {
  return (
    <div className="space-y-3.5">
      {tickets.map((t, i) => (
        <m.div
          key={t.order_item_id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.smooth, delay: Math.min(i, 6) * 0.05 }}
        >
          <TicketCard t={t} onOpen={() => onOpen(t)} />
        </m.div>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="px-1 text-caption font-semibold text-muted">{children}</div>;
}

/** ‹ Avgust 2026 › — never past the current month. */
function MonthStepper({
  month, onMonth, caption,
}: { month: string; onMonth: (m: string) => void; caption: string }) {
  const haptic = useHaptic();
  const thisMonth = tashkentMonth();
  const [dir, setDir] = useState<1 | -1>(-1);
  const step = (delta: -1 | 1) => {
    haptic.selection();
    setDir(delta);
    onMonth(shiftMonth(month, delta));
  };
  return (
    <div className="glass flex items-center justify-between rounded-[24px] p-1.5">
      <IconButton variant="ghost" aria-label="Oldingi oy" onClick={() => step(-1)}>
        <ChevronLeft strokeWidth={2.4} />
      </IconButton>
      <div className="relative min-w-0 flex-1 overflow-hidden text-center">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <m.div
            key={month}
            custom={dir}
            initial={{ opacity: 0, x: dir * -22 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * 22 }}
            transition={spring.smooth}
          >
            <div className="text-title-md text-ink">{formatMonth(month)}</div>
            <div className="text-caption text-muted">{caption}</div>
          </m.div>
        </AnimatePresence>
      </div>
      <IconButton
        variant="ghost"
        aria-label="Keyingi oy"
        disabled={month >= thisMonth}
        onClick={() => step(1)}
      >
        <ChevronRight strokeWidth={2.4} />
      </IconButton>
    </div>
  );
}

const ARCHIVE_EMPTY = {
  past:     { title: "Bu oyda xarid qilingan safar yo'q", body: "Oldingi oylarni ‹ bilan varaqlang.", icon: Archive },
  returned: { title: "Bu oyda qaytarilgan chipta yo'q",   body: "Oldingi oylarni ‹ bilan varaqlang.", icon: Undo2 },
} as const;

/**
 * One month of eticket's archive — the month a ticket was BOUGHT, which is
 * how eticket files it — narrowed to trips travelled or trips returned.
 * Most recent departure first.
 */
function ArchivePanel({
  month, onMonth, show, onOpen,
}: { month: string; onMonth: (m: string) => void; show: "past" | "returned"; onOpen: (t: PurchasedTicket) => void }) {
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
    <div className="space-y-4">
      <MonthStepper month={month} onMonth={onMonth} caption={caption} />
      {q.isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : q.isError ? (
        <EmptyNote title="Arxivni yuklab bo'lmadi" body="Birozdan so'ng qayta urinib ko'ring." />
      ) : tickets.length === 0 ? (
        <EmptyNote {...ARCHIVE_EMPTY[show]} />
      ) : (
        <Cards tickets={tickets} onOpen={onOpen} />
      )}
    </div>
  );
}

function TicketsSkeleton() {
  return (
    <Screen tabbed padded title="Chiptalarim" reveal={false}>
      <Skeleton className="h-11 rounded-full" />
      <div className="space-y-3.5">
        {[0, 1].map(i => <Skeleton key={i} className="h-[178px] rounded-[26px]" />)}
      </div>
    </Screen>
  );
}

export function Tickets() {
  const navigate = useNavigate();
  const haptic = useHaptic();
  const q = useQuery({ queryKey: ["tickets"], queryFn: listTickets, retry: false });
  const [picked, setPicked] = useState<Leg | null>(null);
  const [month, setMonth] = useState(tashkentMonth);

  // The ticket open in the sheet. Kept after closing so the sheet can animate
  // out still showing it.
  const [sheetLeg, setSheetLeg] = useState<PurchasedTicket | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const open = (t: PurchasedTicket) => { setSheetLeg(t); setSheetOpen(true); };

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

  if (q.isLoading) return <TicketsSkeleton />;

  if (q.isError) {
    const code = (q.error as any)?.response?.data?.error?.code;
    if (code === "railway_account_required") {
      return (
        <StatusView
          kind="empty"
          header="Akkount ulanmagan"
          description="Chiptalaringizni ko'rish uchun eticket.railway.uz akkountingizni ulang."
          action={<Button onClick={() => navigate("/railway-link")}>
            <Link2 strokeWidth={2.2} />
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
    <Screen tabbed padded title="Chiptalarim" reveal={false}>
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

        <TabsContent value="upcoming" className="mt-5">
          {upcoming.length === 0 ? (
            <EmptyNote
              icon={TicketIcon}
              title="Kelgusi safar yo'q"
              body="Yangi chipta sotib olinganda shu yerda ko'rinadi."
            />
          ) : (
            <Cards tickets={upcoming} onOpen={open} />
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-5">
          <ArchivePanel month={month} onMonth={setMonth} show="past" onOpen={open} />
        </TabsContent>

        {/* Returned tickets have no list of their own on eticket: the ones
            with a future date still sit in the active list, the rest in the
            archive under the month they were bought. Both, in that order. */}
        <TabsContent value="returned" className="mt-5">
          <div className="space-y-6">
            {upcomingReturned.length > 0 && (
              <div className="space-y-2.5">
                <SectionLabel>Kelgusi sanaga</SectionLabel>
                <Cards tickets={upcomingReturned} onOpen={open} />
              </div>
            )}
            <div className="space-y-2.5">
              <SectionLabel>Arxiv</SectionLabel>
              <ArchivePanel month={month} onMonth={setMonth} show="returned" onOpen={open} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <TicketSheet leg={sheetLeg} open={sheetOpen} onOpenChange={setSheetOpen} />
    </Screen>
  );
}
