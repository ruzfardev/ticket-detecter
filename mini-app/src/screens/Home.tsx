import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as m from "motion/react-m";
import {
  Plus, Sparkles, Bell, Ticket, TrainFront, CalendarDays, ChevronRight,
  Train, AlertCircle, Clock, CheckCircle2, Zap, RefreshCw,
} from "lucide-react";

import {
  getMe, getRailwayStatus, isReservedLeg, listOrders, listSubscriptions, listTickets,
  type Subscription,
} from "@/api/client";
import { useWizard } from "@/store/wizard";
import { useHaptic } from "@/hooks/useHaptic";
import { useTelegram } from "@/hooks/useTelegram";
import { spring } from "@/lib/motion";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { HomeSkeleton } from "@/components/HomeSkeleton";
import { Logo } from "@/components/Logo";
import { EmptyNote } from "@/components/EmptyNote";
import { Specular } from "@/components/glass/Specular";
import { Ticker } from "@/components/motion/Ticker";
import { TicketShell } from "@/components/trip/TicketShell";
import { TripTimes } from "@/components/trip/TripTimes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { PressCard } from "@/components/ui/press-card";
import { IconTile } from "@/components/ui/tile";
import { cn } from "@/lib/utils";
import { formatShortDate, tashkentDate } from "@/lib/dates";
import { dayOffset, trainTime } from "@/lib/traintime";

/* ── Small building blocks ─────────────────────────────────────────── */

function AvatarButton({ url, name, onClick }: { url?: string; name: string; onClick: () => void }) {
  const initial = (name.trim()[0] ?? "C").toUpperCase();
  return (
    <IconButton
      aria-label={`${name} — sozlamalar`}
      onClick={onClick}
      className="overflow-hidden p-0 text-[17px] font-semibold text-coral-ink"
    >
      {url ? <img src={url} alt="" className="size-full rounded-full object-cover" /> : initial}
    </IconButton>
  );
}

function StatusPill({ sub }: { sub: Subscription }) {
  const text = !sub.is_active ? "pauzada" : sub.autobuy_enabled ? "avto-xarid" : "kuzatuvda";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-caption font-medium",
        sub.is_active ? "text-coral-ink" : "text-muted",
      )}
    >
      <i
        aria-hidden
        className={cn(
          "live-dot live-dot--still !size-[7px]",
          sub.is_active ? "" : "!bg-muted-soft !shadow-none",
        )}
      />
      {text}
    </span>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** A ring that drains as the SMS-code window closes. */
function CountdownRing({ secs, total = 600 }: { secs: number | null; total?: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const left = secs === null ? 1 : Math.max(0, Math.min(1, secs / total));
  return (
    <span className="relative flex size-11 shrink-0 items-center justify-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - left)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <Clock width={18} height={18} strokeWidth={2.2} />
    </span>
  );
}

/* ── Screen ────────────────────────────────────────────────────────── */

export function Home() {
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { user: tgUser } = useTelegram();
  const reset = useWizard(s => s.reset);
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const subs = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });
  const railway = useQuery({ queryKey: ["railwayAccount"], queryFn: getRailwayStatus });
  const linked = railway.data?.linked === true;
  const orders = useQuery({
    queryKey: ["orders"], queryFn: listOrders,
    enabled: linked,
    refetchInterval: 8000,
  });
  // Shares the Tickets tab's cache; one eticket round-trip per 5 min at most.
  const tickets = useQuery({
    queryKey: ["tickets"], queryFn: listTickets,
    enabled: linked,
    staleTime: 5 * 60_000,
  });
  const awaitingOtp = (orders.data ?? []).find(o => o.status === "awaiting_otp");
  // The nearest valid ticket leaving today or tomorrow, Tashkent time.
  const trip = useMemo(() => {
    const today = tashkentDate(0), tomorrow = tashkentDate(1);
    const legs = (tickets.data ?? [])
      .filter(t => !t.returned && !isReservedLeg(t)
        && (t.dep_at.startsWith(today) || t.dep_at.startsWith(tomorrow)))
      .sort((a, b) => (a.dep_at < b.dep_at ? -1 : a.dep_at > b.dep_at ? 1 : 0));
    return legs[0] ? { leg: legs[0], today: legs[0].dep_at.startsWith(today) } : null;
  }, [tickets.data]);

  // OTP countdown: tick locally between the 8 s refetches.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!awaitingOtp) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [awaitingOtp?.id]);
  const otpSecs =
    awaitingOtp && awaitingOtp.seconds_until_expiry !== null
      ? Math.max(0, awaitingOtp.seconds_until_expiry - Math.floor((now - orders.dataUpdatedAt) / 1000))
      : null;
  // One haptic nudge per new OTP request — it is the only time-critical thing here.
  const warned = useRef<number | null>(null);
  useEffect(() => {
    if (awaitingOtp && warned.current !== awaitingOtp.id) {
      warned.current = awaitingOtp.id;
      haptic.notify("warning");
    }
  }, [awaitingOtp?.id, haptic]);

  if (me.isLoading || subs.isLoading) return <HomeSkeleton />;
  if (!me.data || !subs.data) {
    return <StatusView kind="error" description="Ma'lumotni yuklab bo'lmadi." />;
  }

  const { slot, user } = me.data;
  const isFree = user.tier === "free";
  const slotFull = slot.used >= slot.max;
  const blocked = slotFull && isFree;
  const all = subs.data.subscriptions;
  const active = all.filter(s => s.is_active);
  const paused = all.filter(s => !s.is_active);
  const anyAutobuy = active.some(s => s.autobuy_enabled);
  const intervalS = me.data.watcher?.interval_s;
  const unlimited = slot.max >= 999;

  const name =
    [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(" ") || "Mehmon";
  const go = (path: string) => () => { haptic.selection(); navigate(path); };

  const handleNew = () => {
    haptic.impact("light");
    if (blocked) { navigate("/premium"); return; }
    reset();
    navigate("/new");
  };

  const caption =
    active.length > 0
      ? `Joy chiqsa — darhol xabar${anyAutobuy ? " yoki avto-xarid" : ""}.`
      : paused.length > 0
        ? "Hammasi pauzada — ro'yxatdan qayta yoqing."
        : "Marshrut, sana va poyezdni tanlang — joy chiqsa xabar beramiz.";

  const subRow = (s: Subscription) => (
    <ListRow
      key={s.id}
      title={`${s.dep_name} → ${s.arr_name}`}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays width={14} height={14} strokeWidth={1.9} />
          {formatShortDate(s.travel_date)} · {s.train_numbers.length ? s.train_numbers.join(", ") : "har qanday"}
        </span>
      }
      // The status is the trailing element; a chevron as well would only
      // eat title width ("Toshkent → Samarqand" has to stay on one line).
      after={<StatusPill sub={s} />}
      onClick={() => navigate(`/sub/${s.id}`)}
    />
  );

  const ordersActive = (orders.data ?? []).filter(o =>
    ["reserving", "awaiting_otp", "paying"].includes(o.status)).length;
  // A returned ticket is still in eticket's active list; it is not a trip.
  const ticketCount = (tickets.data ?? []).filter(t => !t.returned && !isReservedLeg(t)).length;

  const tripDur = trip
    ? dayOffset(trip.leg.dep_at.replace(" ", "T"), trip.leg.arr_at.replace(" ", "T"))
    : 0;

  return (
    <Screen tabbed padded>
      {/* Top strip — the mark, then the account facts as one quiet line: tier,
          poll cadence, eticket link. Nothing here competes with the OTP
          banner or the CTA for attention. */}
      <header className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 text-ink">
          <Logo size={28} live={active.length > 0} />
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant={isFree ? "pill" : "solid"}>{isFree ? "Free" : "Premium"}</Badge>
            {intervalS !== undefined && (
              <span className="inline-flex items-center gap-1 text-caption font-medium text-muted">
                {isFree
                  ? <RefreshCw width={12} height={12} strokeWidth={2.2} />
                  : <Zap width={12} height={12} strokeWidth={2.2} className="text-coral-ink" />}
                har {intervalS} s
              </span>
            )}
            {linked && (
              <span className="inline-flex items-center gap-1 text-caption font-medium text-muted">
                <CheckCircle2 width={12} height={12} strokeWidth={2.2} className="text-success" />
                eticket
              </span>
            )}
          </div>
        </div>
        <AvatarButton url={tgUser?.photo_url} name={name} onClick={go("/settings")} />
      </header>

      {/* Awaiting-OTP banner — the one time-critical element, always first. */}
      {awaitingOtp && (
        <PressCard
          material="none"
          onClick={() => navigate(`/order/${awaitingOtp.id}`)}
          className="glass-prominent relative flex items-center gap-3.5 overflow-hidden rounded-[26px] p-4"
          aria-label="SMS kodni kiriting"
        >
          <Specular />
          <CountdownRing secs={otpSecs} />
          <div className="relative min-w-0 flex-1">
            <div className="text-title-md">SMS kodni kiriting</div>
            <div className="truncate text-caption text-on-primary/85">
              {awaitingOtp.train_number} · Vagon {awaitingOtp.car_number} · Joy{" "}
              {awaitingOtp.seat_numbers?.length ? awaitingOtp.seat_numbers.join(", ") : awaitingOtp.seat_number}
            </div>
          </div>
          {otpSecs !== null && (
            <Ticker value={mmss(otpSecs)} className="relative text-[24px] font-semibold" />
          )}
          <ChevronRight className="relative shrink-0 opacity-90" width={20} height={20} strokeWidth={2.4} />
        </PressCard>
      )}

      {/* A trip today or tomorrow outranks the counters. */}
      {trip && (
        <PressCard material="none" onClick={go("/tickets")} className="rounded-[26px]" aria-label="Safar chiptasi">
          <TicketShell
            tone="tint"
            top={
              <div className="space-y-3">
                <div className="flex items-center justify-between text-caption font-semibold">
                  <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.06em] text-coral-ink">
                    <TrainFront width={15} height={15} strokeWidth={2.2} />
                    {trip.today ? "Bugun safar" : "Ertaga safar"}
                  </span>
                  <span className="tnum text-muted">{trip.leg.train_number}</span>
                </div>
                <TripTimes
                  tone="coral"
                  moving
                  dep={{ station: trip.leg.dep_station, time: trainTime(trip.leg.dep_at.replace(" ", "T")) }}
                  arr={{
                    station: trip.leg.arr_station,
                    time: trainTime(trip.leg.arr_at.replace(" ", "T")),
                    plus: tripDur,
                  }}
                />
              </div>
            }
            bottom={
              <div className="flex items-center justify-between text-body-sm text-body">
                <span>Vagon {trip.leg.car_number} · joy {trip.leg.seats.join(", ") || "—"}</span>
                <span className="inline-flex items-center gap-0.5 font-semibold text-coral-ink">
                  Chipta <ChevronRight width={16} height={16} strokeWidth={2.6} />
                </span>
              </div>
            }
          />
        </PressCard>
      )}

      {/* Hero — what the app is doing right now, and the one primary action. */}
      <section className="glass relative overflow-hidden rounded-[30px] p-5">
        <Specular />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-caption font-semibold text-muted">
                <i aria-hidden className={cn("live-dot", active.length === 0 && "live-dot--still !bg-muted-soft !shadow-none")} />
                Kuzatuvda
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <Ticker value={active.length} className="text-[64px] font-bold leading-none text-ink" />
                <span className="text-title-md text-muted">/ {unlimited ? "∞" : slot.max} slot</span>
              </div>
            </div>
            <Logo size={48} live={active.length > 0} className="text-ink/90" />
          </div>

          {!unlimited && (
            <div className="mt-3.5 flex gap-1.5" aria-hidden>
              {Array.from({ length: Math.min(slot.max, 8) }).map((_, i) => (
                <m.span
                  key={i}
                  initial={false}
                  animate={{ width: i < active.length ? 28 : 10 }}
                  transition={spring.bouncy}
                  className={cn(
                    "h-2 rounded-full",
                    i < active.length ? "bg-coral-bright shadow-[0_0_10px_hsl(var(--coral-bright)/0.6)]" : "bg-ink/14",
                  )}
                />
              ))}
            </div>
          )}

          <p className="mt-3.5 text-body-sm text-body">{caption}</p>

          <Button size="lg" full className="mt-5" onClick={handleNew}>
            {blocked
              ? <><Sparkles strokeWidth={2.2} />Slot to'lgan — Premium</>
              : <><Plus strokeWidth={2.6} />Yangi xabarnoma</>}
          </Button>
        </div>
      </section>

      {/* Account states that need the user's hand */}
      {railway.data && !linked && (
        <ListGroup>
          <ListRow
            before={<IconTile icon={Train} tone="coral" />}
            title="eticket akkauntni ulang"
            subtitle="Avto-xarid va chiptalar uchun"
            chevron
            onClick={go("/railway-link")}
          />
        </ListGroup>
      )}
      {railway.data?.link_status === "login_failed" && (
        <ListGroup>
          <ListRow
            before={<IconTile icon={AlertCircle} tone="red" />}
            title="Parol eskirgan"
            subtitle="eticket akkauntni qayta ulang"
            chevron
            onClick={go("/railway-link")}
          />
        </ListGroup>
      )}

      {/* Notifications */}
      {all.length === 0 ? (
        <EmptyNote
          icon={TrainFront}
          title="Hali xabarnoma yo'q"
          body="“Yangi xabarnoma” tugmasini bosing — joy paydo bo'lishi bilan Telegram orqali xabar yetadi."
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <ListGroup label="Xabarnomalar">{active.map(subRow)}</ListGroup>
          )}
          {paused.length > 0 && (
            <ListGroup label="Pauzada">{paused.map(subRow)}</ListGroup>
          )}
        </div>
      )}

      {/* Glance: orders in flight / tickets owned — only meaningful once linked */}
      {linked && (
        <div className="grid grid-cols-2 gap-3">
          <PressCard onClick={go("/orders")} className="rounded-[24px] p-4">
            <IconTile icon={Bell} tone="coral" soft size={36} />
            <div className="mt-3.5 text-display-lg text-ink">
              <Ticker value={ordersActive} />
            </div>
            <div className="text-caption text-muted">Buyurtma jarayonda</div>
          </PressCard>
          <PressCard onClick={go("/tickets")} className="rounded-[24px] p-4">
            <IconTile icon={Ticket} tone="teal" soft size={36} />
            <div className="mt-3.5 text-display-lg text-ink">
              {tickets.isLoading ? "…" : <Ticker value={ticketCount} />}
            </div>
            <div className="text-caption text-muted">Chipta sotib olingan</div>
          </PressCard>
        </div>
      )}

      {/* Premium upsell (free only) */}
      {isFree && (
        <PressCard material="glass" onClick={go("/premium")} className="flex items-center gap-3.5 p-4">
          <IconTile icon={Sparkles} tone="amber" size={40} />
          <div className="min-w-0 flex-1">
            <div className="text-title-md text-ink">Premium — 3× tezroq, 3 slot</div>
            <div className="text-caption text-muted">Joyni birinchi bo'lib ilg'ang</div>
          </div>
          <ChevronRight className="shrink-0 text-muted-soft" width={20} height={20} strokeWidth={2.2} />
        </PressCard>
      )}
    </Screen>
  );
}
