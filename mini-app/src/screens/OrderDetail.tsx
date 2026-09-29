import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import * as m from "motion/react-m";
import { AnimatePresence, type Variants } from "motion/react";
import {
  AlertCircle, Banknote, CalendarDays, Check, CreditCard, KeyRound, RefreshCw,
  TrainFront, UserRound, Users, X,
} from "lucide-react";

import {
  cancelOrder, getOrder, resendOrderOtp, submitOrderOtp,
  type AutobuyOrderStatus,
} from "@/api/client";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { StickyAction } from "@/components/StickyAction";
import { Specular } from "@/components/glass/Specular";
import { Ticker } from "@/components/motion/Ticker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { IconTile } from "@/components/ui/tile";
import { useTelegram } from "@/hooks/useTelegram";
import { reveal, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

function formatMmSs(secs: number | null): string {
  if (secs === null) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<AutobuyOrderStatus, { text: string; tone: "muted"|"success"|"coral"|"outline" }> = {
  reserving:    { text: "Bron qilinmoqda",   tone: "outline" },
  awaiting_otp: { text: "OTP kutilmoqda",    tone: "coral" },
  paying:       { text: "To'lov ishlanmoqda", tone: "outline" },
  paid:         { text: "To'landi",          tone: "success" },
  failed:       { text: "Xato",              tone: "muted" },
  expired:      { text: "Muddati o'tdi",     tone: "muted" },
  cancelled:    { text: "Bekor qilingan",    tone: "muted" },
};

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];

/** "2026-09-30" → "30 sentabr, chorshanba". A calendar date, so read in UTC. */
function travelDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${WEEKDAYS[d.getUTCDay()]}`;
}

/** Let a long value run onto a second line rather than lose its end. */
function Wrap({ children }: { children: ReactNode }) {
  return <span className="line-clamp-2 whitespace-normal">{children}</span>;
}

/* ── Motion ─────────────────────────────────────────────────────────────
   The screen staggers its own blocks (Screen's `reveal` is off): the hero
   is glass, and a block that fades in would blind it — an ancestor at
   opacity < 1 is a backdrop root. So the hero block only moves; the glass
   inside it fades itself. */

const rise: Variants = {
  hidden: { y: 16, scale: 0.985 },
  show: (i: number = 0) => ({
    y: 0,
    scale: 1,
    transition: { ...spring.smooth, delay: Math.min(i, 8) * 0.045 },
  }),
};

function Block({ i, glass, children }: { i: number; glass?: boolean; children: ReactNode }) {
  return (
    <m.div variants={glass ? rise : reveal} custom={i} initial="hidden" animate="show">
      {children}
    </m.div>
  );
}

/* ── Hero ───────────────────────────────────────────────────────────── */

const RING = 124;

/** Drains around the medallion as the SMS-code window closes. */
function CountdownRing({ secs, total = 600, urgent }: { secs: number | null; total?: number; urgent: boolean }) {
  const r = RING / 2 - 3;
  const c = 2 * Math.PI * r;
  const left = secs === null ? 1 : Math.max(0, Math.min(1, secs / total));
  return (
    <svg
      viewBox={`0 0 ${RING} ${RING}`}
      className={cn("absolute inset-0 -rotate-90 transition-colors duration-500", urgent ? "text-error" : "text-coral-bright")}
      aria-hidden
    >
      <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
      <circle
        cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - left)}
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}

/**
 * The order's state as one glass medallion: a key inside the draining ring
 * while the SMS code is awaited, a breathing spinner while the seat is being
 * booked, a spinner while eticket settles, a check once paid, a quiet cross
 * when it ended any other way.
 */
function Medallion({ status, secs, urgent }: { status: AutobuyOrderStatus; secs: number | null; urgent: boolean }) {
  const otp = status === "awaiting_otp";
  const paid = status === "paid";
  const breathing = status === "reserving";
  const glyph =
    otp ? "otp" :
    status === "reserving" || status === "paying" ? "busy" :
    paid ? "paid" : "ended";

  return (
    <div className="relative grid place-items-center" style={{ width: RING, height: RING }}>
      <AnimatePresence>
        {otp && (
          <m.span
            key="ring"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={spring.smooth}
          >
            <CountdownRing secs={secs} urgent={urgent} />
          </m.span>
        )}
      </AnimatePresence>
      {breathing && (
        <m.span
          aria-hidden
          className="absolute size-[92px] rounded-full border-2 border-coral-bright/50"
          animate={{ scale: [1, 1.32], opacity: [0.8, 0] }}
          transition={{ duration: 2.2, ease: "easeOut", repeat: Infinity }}
        />
      )}
      {/* Breathing is a transform, so it may sit above the glass; the glass
          fades itself in. */}
      <m.div
        animate={{ scale: breathing ? [1, 1.045, 1] : 1 }}
        transition={breathing ? { duration: 2.2, ease: "easeInOut", repeat: Infinity } : spring.smooth}
      >
        <m.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.bouncy}
          className={cn(
            "glass relative flex size-[92px] items-center justify-center overflow-hidden rounded-full",
            paid && "glass-tint [--tint:var(--success)]",
          )}
        >
          <Specular range={10} />
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={glyph}
              className="relative flex"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={spring.bouncy}
            >
              {glyph === "otp" && <KeyRound className="size-9 text-coral-ink" strokeWidth={1.9} />}
              {glyph === "busy" && <Spinner size="lg" />}
              {glyph === "paid" && <Check className="pop-in size-10 text-success" strokeWidth={2.6} />}
              {glyph === "ended" && <X className="size-9 text-muted" strokeWidth={2.1} />}
            </m.span>
          </AnimatePresence>
        </m.div>
      </m.div>
    </div>
  );
}

/** Loading, shaped like the screen: the medallion, then the details. */
function OrderSkeleton() {
  return (
    <Screen padded title="Buyurtma" reveal={false}>
      <div className="flex flex-col items-center gap-4 py-1">
        <Skeleton className="size-[92px] rounded-full" />
        <Skeleton className="h-6 w-44 rounded-full" />
      </div>
      <div className="space-y-px overflow-hidden rounded-[26px]">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[66px] rounded-none" />)}
      </div>
    </Screen>
  );
}

/* ── Screen ─────────────────────────────────────────────────────────── */

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showConfirm } = useTelegram();

  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (!s || ["paid","failed","expired","cancelled"].includes(s)) return false;
      return 4000;
    },
  });

  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: (code: string) => submitOrderOtp(orderId, code),
    onSuccess: (updated) => {
      setOtpError(null);
      // A 200 here only means the code was handed to eticket. The order's
      // status says what actually happened — it is `paid` only once eticket
      // settled; `paying` means we are still waiting on them. Saying
      // "successful" on `paying` (as this used to) was a lie the user saw
      // seconds before the polling showed otherwise.
      if (updated.status === "paid") {
        toast.success("Chipta sotib olindi!");
      } else if (updated.status === "paying") {
        toast.message(updated.failure_reason ?? "Kod yuborildi — eticket tasdiqlashi kutilmoqda");
      } else if (updated.failure_reason) {
        toast.message(updated.failure_reason);
      }
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code;
      const msg =
        code === "payment_failed"
          ? "Kod noto'g'ri yoki muddati o'tgan. Qaytadan kiriting."
          : "Kodni tekshirib bo'lmadi. Yana urinib ko'ring.";
      // The hold is still alive — clear the field so the user can retype
      // immediately instead of editing over a rejected code.
      setOtp("");
      setOtpError(msg);
      toast.error(msg);
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  const resend = useMutation({
    mutationFn: () => resendOrderOtp(orderId),
    onSuccess: () => toast.success("SMS qaytadan yuborildi"),
    onError: () => toast.error("Qayta yuborib bo'lmadi"),
  });

  const cancel = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: () => {
      toast.success("Bekor qilindi");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  useEffect(() => { setOtp(""); setOtpError(null); }, [orderId]);

  // Hand the user to Buyurtmalar once the purchase completes *in this view*.
  // Keyed on the transition (live status -> paid) rather than on "status is
  // paid", so opening an already-paid order from the list does not bounce
  // straight back to it.
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const status = order.data?.status;
    const was = prevStatus.current;
    prevStatus.current = status;
    if (status !== "paid" || !was || was === "paid") return;
    if (!["reserving", "awaiting_otp", "paying"].includes(was)) return;
    const t = setTimeout(() => navigate("/orders", { replace: true }), 1500);
    return () => clearTimeout(t);
  }, [order.data?.status, navigate]);

  // The countdown ticks on the device between the 4 s polls.
  const awaiting = order.data?.status === "awaiting_otp";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!awaiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [awaiting]);

  if (order.isLoading) return <OrderSkeleton />;
  if (!order.data) {
    return (
      <StatusView
        kind="error"
        description="Buyurtma topilmadi"
        action={
          <Button variant="secondary" onClick={() => navigate("/orders")}>
            Buyurtmalar
          </Button>
        }
      />
    );
  }

  const o = order.data;
  const label = STATUS_LABEL[o.status];
  const otpDigits = otp.replace(/\D/g, "");
  const seats = o.seat_numbers?.length ? o.seat_numbers : [o.seat_number];
  const passengers = o.passenger_names ?? [];
  const secs =
    o.seconds_until_expiry === null
      ? null
      : Math.max(0, o.seconds_until_expiry - Math.floor(Math.max(0, now - order.dataUpdatedAt) / 1000));
  const urgent = secs !== null && secs < 60;
  const ended = o.status === "failed" || o.status === "expired" || o.status === "cancelled";
  const cancellable = o.status === "awaiting_otp" || o.status === "paying";

  // What the hero says under the medallion, per state.
  const heroText: ReactNode =
    o.status === "awaiting_otp" ? (
      <>
        <Ticker
          value={formatMmSs(secs)}
          className={cn("text-[44px] font-semibold leading-none", urgent ? "text-error" : "text-ink")}
        />
        <p className="mt-1.5 text-body-sm text-muted">Buyurtma bekor bo'lishi qoldi</p>
      </>
    ) : o.status === "reserving" ? (
      <h2 className="font-display text-display-sm text-ink">Bron qilinmoqda…</h2>
    ) : o.status === "paying" ? (
      <>
        <h2 className="font-display text-display-sm text-ink">
          {o.otp_confirmed_at ? "Kod qabul qilingan" : "To'lov tekshirilmoqda…"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-[34ch] text-body-sm text-muted">
          {o.failure_reason
            ?? "eticket to'lovni tasdiqlashi bir necha soniya olishi mumkin. Kod noto'g'ri bo'lsa, qaytadan kiritish uchun shu yerga qaytasiz."}
        </p>
      </>
    ) : o.status === "paid" ? (
      <>
        <h2 className="font-display text-display-sm text-ink">Chipta sotib olindi!</h2>
        <p className="mx-auto mt-1.5 max-w-[34ch] text-body-sm text-muted">
          Chipta eticket.railway.uz akkountingizdagi
          "Mening yangi buyurtmalarim"da ko'rinadi.
        </p>
      </>
    ) : (
      <>
        <h2 className="font-display text-display-sm text-ink">{label.text}</h2>
        {o.failure_reason && (
          <p className="mx-auto mt-1.5 max-w-[34ch] text-body-sm text-muted">{o.failure_reason}</p>
        )}
      </>
    );

  // A way out, where the old inline blocks had one.
  const heroAction =
    o.status === "reserving" ? (
      <Button variant="secondary" onClick={() => navigate("/orders")}>
        Buyurtmalar
      </Button>
    ) : o.status === "paid" ? (
      <Button variant="secondary" onClick={() => navigate("/orders", { replace: true })}>
        Buyurtmalar
      </Button>
    ) : ended ? (
      <Button variant="secondary" onClick={() => navigate("/home")}>
        Bosh sahifaga
      </Button>
    ) : null;

  let block = 0;

  return (
    <Screen
      padded
      title="Buyurtma"
      subtitle={<Badge variant={label.tone}>{label.text}</Badge>}
      reveal={false}
    >
      {/* Hero — the state at a glance */}
      <Block i={block++} glass>
        <section className="flex flex-col items-center text-center">
          <Medallion status={o.status} secs={secs} urgent={urgent} />
          <m.div
            key={o.status}
            className="mt-4 w-full"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.smooth, delay: 0.06 }}
          >
            {heroText}
          </m.div>
          {heroAction && <div className="mt-5">{heroAction}</div>}
        </section>
      </Block>

      {o.status === "awaiting_otp" && (
        <Block i={block++}>
          <div className="space-y-2.5">
            <Label htmlFor="otp" className="text-center">SMS kod</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="done"
              autoFocus
              maxLength={10}
              placeholder="• • • • •"
              value={otp}
              aria-invalid={otpError ? true : undefined}
              aria-describedby={otpError ? "otp-error" : undefined}
              onChange={e => {
                setOtp(e.target.value);
                if (otpError) setOtpError(null);
              }}
              // One big code, centred; the left pad balances the tracking the
              // last digit carries on its right.
              className="h-[68px] rounded-[22px] [&_input]:pl-[0.35em] [&_input]:text-center [&_input]:text-[28px] [&_input]:font-semibold [&_input]:tracking-[0.35em] [&_input]:[font-variant-numeric:tabular-nums] [&_input]:placeholder:tracking-[0.2em]"
            />
            <div className="space-y-1 px-1 text-center">
              {otpError && (
                <p id="otp-error" role="alert" className="text-body-sm text-error">
                  <AlertCircle size={16} strokeWidth={2} className="mr-1.5 inline -translate-y-px align-middle" />
                  {otpError}
                </p>
              )}
              {!otpError && o.failure_reason && o.otp_attempts ? (
                // The backend's own account of the last attempt (e.g. "not
                // settled yet — retype if it was wrong, wait if it was right").
                <p className="text-body-sm text-body">
                  <AlertCircle size={16} strokeWidth={2} className="mr-1.5 inline -translate-y-px align-middle text-muted" />
                  {o.failure_reason}
                </p>
              ) : null}
              <p className={cn("text-caption", urgent ? "font-semibold text-error" : "text-muted")}>
                {urgent ? "Muddat tugamoqda!" : "Telefoningizga kelgan kodni kiriting"}
              </p>
            </div>
            <div className="flex items-center justify-between">
              {/* Telegram deep-links straight here, so this screen must offer its
                  own way out — the WebView has no history to go back to. */}
              <Button variant="link" size="sm" onClick={() => navigate("/orders")}>
                Buyurtmalar
              </Button>
              <Button
                variant="link"
                size="sm"
               
                loading={resend.isPending}
                onClick={() => resend.mutate()}
              >
                {!resend.isPending && <RefreshCw strokeWidth={2} />}
                SMS'ni qayta yuborish
              </Button>
            </div>
          </div>
        </Block>
      )}

      <Block i={block++}>
        <ListGroup label="Tafsilotlar">
          <ListRow
            before={<IconTile icon={TrainFront} tone="coral" />}
            title={`${o.train_number} · Vagon ${o.car_number}`}
            subtitle={seats.length > 1 ? `Joylar: ${seats.join(", ")}` : `Joy ${seats[0]}`}
          />
          <ListRow
            before={<IconTile icon={CalendarDays} tone="blue" />}
            title={travelDay(o.travel_date)}
            subtitle="Sana"
          />
          {passengers.length > 0 ? (
            <ListRow
              before={<IconTile icon={passengers.length > 1 ? Users : UserRound} tone="teal" />}
              title={<Wrap>{passengers.join(", ")}</Wrap>}
              subtitle={passengers.length > 1 ? `Yo'lovchilar · ${passengers.length} ta` : "Yo'lovchi"}
            />
          ) : o.friend_name ? (
            <ListRow
              before={<IconTile icon={UserRound} tone="teal" />}
              title={o.friend_name}
              subtitle="Yo'lovchi"
            />
          ) : null}
          {o.amount_uzs !== null && (
            <ListRow
              before={<IconTile icon={Banknote} tone="green" />}
              title={<span className="tnum">{`${o.amount_uzs.toLocaleString("ru-RU")} so'm`}</span>}
              subtitle="Narx"
            />
          )}
          {o.last4 && (
            <ListRow
              before={<IconTile icon={CreditCard} tone="gray" />}
              title={<span className="tnum">{`•••• ${o.last4}`}</span>}
              subtitle="Karta"
            />
          )}
        </ListGroup>
      </Block>

      {cancellable && (
        <Block i={block++}>
          <ListGroup>
            <ListRow
              before={<IconTile icon={X} tone="red" />}
              title="Buyurtmani bekor qilish"
              destructive
              disabled={cancel.isPending}
              after={cancel.isPending ? <Spinner size="sm" className="text-error" /> : undefined}
              onClick={async () => {
                if (await showConfirm("Buyurtmani bekor qilishni xohlaysizmi?")) {
                  cancel.mutate();
                }
              }}
            />
          </ListGroup>
        </Block>
      )}

      {o.status === "awaiting_otp" && (
        <StickyAction
          hint={otpDigits.length < 3 ? "Kod kiriting" : undefined}
        >
          <Button
            full
            size="lg"
            disabled={otpDigits.length < 3}
            loading={submit.isPending}
            onClick={() => submit.mutate(otpDigits)}
          >
            {submit.isPending ? "Yuborilmoqda…" : "Tasdiqlash"}
          </Button>
        </StickyAction>
      )}
    </Screen>
  );
}
