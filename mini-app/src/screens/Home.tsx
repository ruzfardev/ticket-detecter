import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Sparkles, Bell, BellRing, Ticket, TrainFront, ChevronRight,
  Train, AlertCircle, Clock, CheckCircle2, Zap, RefreshCw, Pause,
} from "lucide-react";

import {
  getMe, getRailwayStatus, isReservedLeg, listOrders, listSubscriptions, listTickets,
  patchSubscription, type Subscription,
} from "@/api/client";
import { useWizard } from "@/store/wizard";
import { useCountdown } from "@/hooks/useCountdown";
import { useHaptic } from "@/hooks/useHaptic";
import { useTelegram } from "@/hooks/useTelegram";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { HomeSkeleton } from "@/components/HomeSkeleton";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListGroup } from "@/components/ui/list";
import { cn } from "@/lib/utils";
import { formatShortDate, tashkentDate } from "@/lib/dates";

/* ── Small building blocks ─────────────────────────────────────────── */

function Avatar({ url, name, onClick }: { url?: string; name: string; onClick: () => void }) {
  const initial = (name.trim()[0] ?? "C").toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name} — sozlamalar`}
      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-coral/15 text-caption font-semibold text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initial}
    </button>
  );
}

/** What a subscription is doing, at a glance: a live ring while it watches
 *  (a bolt when it will also buy), a still pause glyph when it does not. */
function SubMark({ sub }: { sub: Subscription }) {
  if (!sub.is_active) {
    return (
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-hairline bg-canvas text-muted">
        <Pause width={14} height={14} strokeWidth={2.25} />
      </span>
    );
  }
  const Icon = sub.autobuy_enabled ? Zap : BellRing;
  return (
    <span aria-hidden className="sub-live relative flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-coral/10 text-coral">
      <Icon width={15} height={15} strokeWidth={2} />
    </span>
  );
}

/** On = watching. A real switch, so pausing never needs a trip to the details. */
function WatchSwitch({ on, busy, onToggle, label }: {
  on: boolean; busy: boolean; onToggle: () => void; label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onToggle}
      // 44 px tap target around a 44×26 track.
      className="flex h-11 w-14 shrink-0 items-center justify-center rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 disabled:opacity-60"
    >
      <span className={cn(
        "relative h-[26px] w-11 rounded-pill transition-colors duration-200",
        on ? "bg-coral" : "bg-muted-soft/45",
      )}>
        <span className={cn(
          "absolute left-[3px] top-[3px] h-5 w-5 rounded-pill bg-white shadow-sm transition-transform duration-200 ease-out",
          on && "translate-x-[18px]",
        )} />
      </span>
    </button>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/* ── Screen ────────────────────────────────────────────────────────── */

export function Home() {
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { user: tgUser } = useTelegram();
  const reset = useWizard(s => s.reset);
  const qc = useQueryClient();
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
  const otpSecs = useCountdown(awaitingOtp?.seconds_until_expiry, orders.dataUpdatedAt);
  // One haptic nudge per new OTP request — it is the only time-critical thing here.
  const warned = useRef<number | null>(null);
  useEffect(() => {
    if (awaitingOtp && warned.current !== awaitingOtp.id) {
      warned.current = awaitingOtp.id;
      haptic.notify("warning");
    }
  }, [awaitingOtp?.id, haptic]);

  // Pause / resume straight from the list. The switch flips at once and rolls
  // back if the server says no — resuming can fail when every slot is taken.
  type SubsData = Awaited<ReturnType<typeof listSubscriptions>>;
  const toggle = useMutation({
    mutationFn: (s: Subscription) => patchSubscription(s.id, { is_active: !s.is_active }),
    onMutate: async (s: Subscription) => {
      haptic.selection();
      await qc.cancelQueries({ queryKey: ["subs"] });
      const prev = qc.getQueryData<SubsData>(["subs"]);
      if (prev) {
        qc.setQueryData<SubsData>(["subs"], {
          ...prev,
          subscriptions: prev.subscriptions.map(x =>
            x.id === s.id ? { ...x, is_active: !s.is_active } : x),
        });
      }
      return { prev };
    },
    onError: (err: any, _s, ctx) => {
      if (ctx?.prev) qc.setQueryData(["subs"], ctx.prev);
      haptic.notify("error");
      const code = err.response?.data?.error?.code;
      if (code === "slot_limit_reached") {
        toast.error("Slot to'lgan — boshqasini pauza qiling yoki Premium oling");
      } else {
        toast.error(err.response?.data?.error?.message || "Bajarilmadi");
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["subs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

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
        ? "Hammasi pauzada — ro'yxatdagi tugma bilan qayta yoqing."
        : "Marshrut, sana va poyezdni tanlang — joy chiqsa xabar beramiz.";

  const subRow = (s: Subscription) => {
    const status = !s.is_active ? "Pauzada" : s.autobuy_enabled ? "Avto-xarid" : "Kuzatuvda";
    return (
      <div key={s.id} className="flex min-h-[64px] items-center gap-1 pr-1.5">
        <button
          type="button"
          onClick={() => navigate(`/sub/${s.id}`)}
          className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pl-4 text-left transition-colors active:bg-hairline-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-coral/40"
        >
          <SubMark sub={s} />
          <span className="min-w-0 flex-1">
            <span className={cn(
              "block truncate text-body-md font-medium transition-colors",
              s.is_active ? "text-ink" : "text-muted",
            )}>
              {s.dep_name} → {s.arr_name}
            </span>
            <span className="mt-0.5 block truncate text-body-sm text-muted">
              <span className={cn("font-medium", s.is_active ? "text-coral" : "text-muted-soft")}>
                {status}
              </span>
              {" · "}{formatShortDate(s.travel_date)}
              {" · "}{s.train_numbers.length ? s.train_numbers.join(", ") : "istalgan poyezd"}
            </span>
          </span>
        </button>
        <WatchSwitch
          on={s.is_active}
          busy={toggle.isPending && toggle.variables?.id === s.id}
          onToggle={() => toggle.mutate(s)}
          label={s.is_active
            ? `${s.dep_name} → ${s.arr_name}: pauza qilish`
            : `${s.dep_name} → ${s.arr_name}: davom ettirish`}
        />
      </div>
    );
  };

  const ordersActive = (orders.data ?? []).filter(o =>
    ["reserving", "awaiting_otp", "paying"].includes(o.status)).length;
  // A returned ticket is still in eticket's active list; it is not a trip.
  const ticketCount = (tickets.data ?? []).filter(t => !t.returned && !isReservedLeg(t)).length;

  return (
    <Screen tabbed padded>
      {/* Top strip — mark only (Telegram already draws the bot name right
          above this), then the account facts as one quiet line: tier, poll
          cadence, eticket link. Not badges: nothing here competes with the
          OTP banner or the CTA for attention. */}
      <header className="flex h-8 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5 text-ink">
          <Logo size={22} />
          <div className="flex min-w-0 items-center gap-1.5 truncate text-caption text-muted">
            <span className={cn("font-medium", isFree ? "text-body" : "text-coral")}>
              {isFree ? "Free" : "Premium"}
            </span>
            {intervalS !== undefined && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  {isFree
                    ? <RefreshCw width={11} height={11} strokeWidth={2} />
                    : <Zap width={11} height={11} strokeWidth={2} className="text-coral" />}
                  har {intervalS} s
                </span>
              </>
            )}
            {linked && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 truncate">
                  <CheckCircle2 width={11} height={11} strokeWidth={2} className="text-success" />
                  eticket ulangan
                </span>
              </>
            )}
          </div>
        </div>
        <Avatar url={tgUser?.photo_url} name={name} onClick={go("/settings")} />
      </header>

      {/* Awaiting-OTP banner — the one time-critical element, always first. */}
      {awaitingOtp && (
        <button
          type="button"
          onClick={() => navigate(`/order/${awaitingOtp.id}`)}
          className="relative flex w-full items-center gap-3 rounded-xl bg-coral p-4 text-left text-on-primary transition-transform active:scale-[0.99]"
        >
          <span aria-hidden className="live-dot absolute right-3 top-3 h-1.5 w-1.5 rounded-pill bg-on-primary" />
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-on-primary/20">
            <Clock width={20} height={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-title-sm">SMS kodni kiriting</div>
            <div className="truncate text-caption text-on-primary/80">
              {awaitingOtp.train_number} · Vagon {awaitingOtp.car_number} · Joy{" "}
              {awaitingOtp.seat_numbers?.length ? awaitingOtp.seat_numbers.join(", ") : awaitingOtp.seat_number}
            </div>
          </div>
          {otpSecs !== null && (
            <span className="font-mono text-title-md tabular-nums">{mmss(otpSecs)}</span>
          )}
          <ChevronRight className="shrink-0" width={20} height={20} strokeWidth={1.75} />
        </button>
      )}

      {/* Hero — what the app is doing right now, and the one primary action. */}
      <section className="relative overflow-hidden rounded-xl border border-coral/15 bg-surface-card p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--coral)/0.18),hsl(var(--accent-teal)/0.08)_60%,transparent)]"
        />
        <div className="absolute right-4 top-4 text-ink">
          <Logo size={40} live={active.length > 0} />
        </div>
        <div className="relative max-w-[calc(100%-52px)]">
          <div className="text-caption-upper uppercase text-muted">Kuzatuvda</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-display-xl font-semibold tabular-nums text-ink">
              {active.length}
            </span>
            <span className="text-title-md tabular-nums text-muted-soft">
              / {slot.max >= 999 ? "∞" : slot.max} slot
            </span>
          </div>
          <p className="mt-1.5 text-body-sm text-body">{caption}</p>
        </div>
        <Button size="lg" full className="relative mt-5 rounded-lg" onClick={handleNew}>
          {blocked
            ? <><Sparkles width={18} height={18} strokeWidth={2} />Slot to'lgan — Premium</>
            : <><Plus width={18} height={18} strokeWidth={2} />Yangi xabarnoma</>}
        </Button>
      </section>

      {/* Account states that need the user's hand */}
      {railway.data && !linked && (
        <button
          type="button"
          onClick={go("/railway-link")}
          className="flex w-full items-center gap-3 rounded-lg border border-hairline bg-canvas p-4 text-left transition-colors hover:bg-surface-soft active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-coral/10">
            <Train className="text-coral" width={20} height={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-title-sm text-ink">eticket akkauntni ulang</div>
            <div className="text-caption text-muted">Avto-xarid va chiptalar uchun</div>
          </div>
          <ChevronRight className="shrink-0 text-muted-soft" width={20} height={20} strokeWidth={1.75} />
        </button>
      )}
      {railway.data?.link_status === "login_failed" && (
        <button
          type="button"
          onClick={go("/railway-link")}
          className="flex w-full items-center gap-3 rounded-lg border border-error/40 bg-error/5 p-4 text-left transition-colors hover:bg-error/10 active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-error/15">
            <AlertCircle className="text-error" width={20} height={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-title-sm text-ink">Parol eskirgan</div>
            <div className="text-caption text-muted">eticket akkauntni qayta ulang</div>
          </div>
          <ChevronRight className="shrink-0 text-muted-soft" width={20} height={20} strokeWidth={1.75} />
        </button>
      )}

      {/* Notifications */}
      {all.length === 0 ? (
        <Card variant="feature" pad="md">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-canvas">
              <TrainFront className="text-ink" width={20} height={20} strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-display-sm text-ink">Hali xabarnoma yo'q</h3>
              <p className="text-body-sm text-body">
                “Yangi xabarnoma” tugmasini bosing — joy paydo bo'lishi bilan Telegram orqali xabar yetadi.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* One list in a stable order: a row that moved to another group
              the moment its switch flipped would jump out from under the
              finger. The mark and the switch say which is paused. */}
          <ListGroup
            label={`Xabarnomalar · ${active.length}/${all.length} faol`}
          >
            {all.map(subRow)}
          </ListGroup>
        </>
      )}

      {/* A trip today or tomorrow outranks the counters */}
      {trip && (
        <button
          type="button"
          onClick={go("/tickets")}
          className="flex w-full items-center gap-3 rounded-lg bg-coral p-4 text-left text-on-primary transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-on-primary/20">
            <TrainFront width={20} height={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-caption-upper uppercase opacity-80">
              {trip.today ? "Bugun safar" : "Ertaga safar"}
            </div>
            <div className="truncate text-title-sm">
              {trip.leg.dep_station} → {trip.leg.arr_station}
            </div>
            <div className="text-caption opacity-80">
              {trip.leg.dep_at.slice(11, 16)} · {trip.leg.train_number} · vagon {trip.leg.car_number} · joy {trip.leg.seats.join(", ")}
            </div>
          </div>
          <ChevronRight width={20} height={20} strokeWidth={1.75} className="shrink-0 opacity-80" />
        </button>
      )}

      {/* Glance: orders in flight / tickets owned — only meaningful once linked */}
      {linked && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={go("/orders")}
            className="relative rounded-lg bg-surface-card p-4 text-left transition-transform active:scale-[0.99]"
          >
            <Bell className="absolute right-3 top-3 text-coral" width={18} height={18} strokeWidth={1.75} />
            <div className="font-display text-display-sm tabular-nums text-ink">{ordersActive}</div>
            <div className="text-caption text-muted">Buyurtma jarayonda</div>
          </button>
          <button
            type="button"
            onClick={go("/tickets")}
            className="relative rounded-lg bg-surface-card p-4 text-left transition-transform active:scale-[0.99]"
          >
            <Ticket className="absolute right-3 top-3 text-coral" width={18} height={18} strokeWidth={1.75} />
            <div className="font-display text-display-sm tabular-nums text-ink">
              {tickets.isLoading ? "…" : ticketCount}
            </div>
            <div className="text-caption text-muted">Chipta sotib olingan</div>
          </button>
        </div>
      )}

      {/* Premium upsell (free only) */}
      {isFree && (
        <button
          type="button"
          onClick={go("/premium")}
          className="flex w-full items-center gap-3 rounded-lg border border-hairline bg-canvas p-4 text-left transition-colors hover:bg-surface-soft active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-coral/10">
            <Sparkles className="text-coral" width={20} height={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-title-sm text-ink">Premium — 3× tezroq, 3 slot</div>
            <div className="text-caption text-muted">Joyni birinchi bo'lib ilg'ang</div>
          </div>
          <ChevronRight className="shrink-0 text-muted-soft" width={20} height={20} strokeWidth={1.75} />
        </button>
      )}
    </Screen>
  );
}
