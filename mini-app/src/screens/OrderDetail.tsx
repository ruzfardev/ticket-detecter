import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle, CalendarDays, Check, CheckCircle2, Clock, KeyRound, RefreshCw,
  Train as TrainIcon, X, XCircle,
} from "lucide-react";

import {
  cancelOrder, getOrder, resendOrderOtp, submitOrderOtp,
  type AutobuyOrderStatus,
} from "@/api/client";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Spinner } from "@/components/ui/spinner";
import { StickyAction } from "@/components/StickyAction";
import { useTelegram } from "@/hooks/useTelegram";
import { useHaptic } from "@/hooks/useHaptic";
import { formatMmSs, useCountdown } from "@/hooks/useCountdown";
import { cn } from "@/lib/utils";
import { formatTravelDate } from "@/lib/dates";

/** Under this many seconds the timer turns red and the phone buzzes once. */
const OTP_URGENT_S = 60;

const SPARK_ANGLES = [-70, -40, -12, 12, 40, 70];

/**
 * The purchase moment: a small boarding pass slides out of a "printer" slot,
 * then a check pops on it with a few sparks. Shown only when the payment
 * completes on this screen, never for an order that was already paid.
 */
function PrintedTicket({ train, car, seats, date }: {
  train: string; car: string; seats: string; date: string;
}) {
  return (
    <div className="flex flex-col items-center pt-2" role="status" aria-label="Chipta sotib olindi">
      {/* the slot */}
      <div className="relative z-10 h-3 w-64 rounded-pill bg-ink/85 shadow-[inset_0_2px_4px_rgba(0,0,0,.45)] dark:bg-black/70 dark:ring-1 dark:ring-hairline" />
      {/* the clip: the pass starts hidden behind the slot */}
      <div className="-mt-1.5 w-56 overflow-hidden pb-6">
        <div className="paid-print relative rounded-b-2xl border border-t-0 border-hairline-soft bg-surface-card px-4 pb-4 pt-5 shadow-[0_12px_24px_-12px_rgba(0,0,0,.35)]">
          <div className="flex items-center gap-2">
            <TrainIcon className="h-4 w-4 text-coral" strokeWidth={2} />
            <span className="font-display text-display-sm text-ink">{train}</span>
          </div>
          <div className="mt-1 text-body-sm text-muted">{date}</div>
          <div className="mt-3 border-t-2 border-dashed border-hairline" />
          <div className="mt-3 flex gap-6">
            <div>
              <div className="text-caption-upper uppercase text-muted">Vagon</div>
              <div className="text-title-sm tabular-nums text-ink">{car}</div>
            </div>
            <div>
              <div className="text-caption-upper uppercase text-muted">Joy</div>
              <div className="text-title-sm tabular-nums text-ink">{seats}</div>
            </div>
          </div>
          {/* the check, stamped on the corner, with sparks */}
          <div className="absolute -bottom-4 right-4">
            {SPARK_ANGLES.map(a => (
              <span
                key={a}
                aria-hidden
                className="paid-spark absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-pill bg-coral"
                style={{ "--a": `${a}deg` } as React.CSSProperties}
              />
            ))}
            <span className="paid-pop flex h-10 w-10 items-center justify-center rounded-pill bg-coral text-on-primary shadow-lg">
              <Check className="h-5 w-5" strokeWidth={3} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<AutobuyOrderStatus, { text: string; tone: "muted"|"success"|"coral"|"outline" }> = {
  reserving:    { text: "Bron qilinmoqda",   tone: "outline" },
  awaiting_otp: { text: "SMS kod kutilmoqda", tone: "coral" },
  paying:       { text: "To'lov ishlanmoqda", tone: "outline" },
  paid:         { text: "To'landi",          tone: "success" },
  failed:       { text: "Xato",              tone: "muted" },
  expired:      { text: "Muddati o'tdi",     tone: "muted" },
  cancelled:    { text: "Bekor qilingan",    tone: "muted" },
};

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
  const haptic = useHaptic();

  // Ticks every second between the 4 s polls, so the clock never jumps.
  const awaiting = order.data?.status === "awaiting_otp";
  const otpSecs = useCountdown(
    awaiting ? order.data?.seconds_until_expiry : null,
    order.dataUpdatedAt,
  );
  // The server sends only "seconds left", not the full window. The largest
  // value seen stands in for it, which is enough to draw the bar.
  const otpWindow = useRef(0);
  if (otpSecs !== null && otpSecs > otpWindow.current) otpWindow.current = otpSecs;
  const otpUrgent = otpSecs !== null && otpSecs <= OTP_URGENT_S;
  const otpOver = otpSecs === 0;
  const buzzed = useRef(false);
  useEffect(() => {
    if (otpUrgent && !otpOver && !buzzed.current) {
      buzzed.current = true;
      haptic.notify("warning");
    }
  }, [otpUrgent, otpOver, haptic]);

  const submit = useMutation({
    mutationFn: (code: string) => submitOrderOtp(orderId, code),
    onSuccess: (updated) => {
      setOtpError(null);
      // A 200 here only means the code was handed to eticket. The order's
      // status says what actually happened — it is `paid` only once eticket
      // settled; `paying` means we are still waiting on them. Saying
      // "successful" on `paying` (as this used to) was a lie the user saw
      // seconds before the polling showed otherwise.
      // `paid` gets no toast: the printed-ticket scene already says it.
      if (updated.status === "paying") {
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
  // The same transition plays the "ticket prints" moment; the hand-off waits
  // for it to finish (~1.8 s) plus a beat to take it in.
  const prevStatus = useRef<string | undefined>(undefined);
  const [justPaid, setJustPaid] = useState(false);
  useEffect(() => {
    const status = order.data?.status;
    const was = prevStatus.current;
    prevStatus.current = status;
    if (status !== "paid" || !was || was === "paid") return;
    if (!["reserving", "awaiting_otp", "paying"].includes(was)) return;
    setJustPaid(true);
    haptic.notify("success");
    const t = setTimeout(() => navigate("/orders", { replace: true }), 2800);
    return () => clearTimeout(t);
  }, [order.data?.status, navigate, haptic]);

  if (order.isLoading) return <StatusView kind="loading" />;
  if (!order.data) return <StatusView kind="error" description="Buyurtma topilmadi" />;

  const o = order.data;
  const label = STATUS_LABEL[o.status];
  const otpDigits = otp.replace(/\D/g, "");
  const seats = o.seat_numbers?.length ? o.seat_numbers : [o.seat_number];
  const passengers = o.passenger_names ?? [];

  // While a code is awaited the input comes first: on a short phone the
  // order details would otherwise push it below the fold.
  const details = (
    <ListGroup label="Tafsilotlar">
      <ListRow
        before={<TrainIcon className="h-5 w-5 text-ink" strokeWidth={1.75} />}
        title={`${o.train_number} · Vagon ${o.car_number}`}
        subtitle={seats.length > 1 ? `Joylar: ${seats.join(", ")}` : `Joy ${seats[0]}`}
      />
      <ListRow
        before={<CalendarDays className="h-5 w-5 text-ink" strokeWidth={1.75} />}
        title={o.travel_date}
        subtitle="Sana"
      />
      {passengers.length > 0 ? (
        <ListRow
          title={passengers.join(", ")}
          subtitle={passengers.length > 1 ? `Yo'lovchilar · ${passengers.length} ta` : "Yo'lovchi"}
        />
      ) : o.friend_name ? (
        <ListRow title={o.friend_name} subtitle="Yo'lovchi" />
      ) : null}
      {o.amount_uzs !== null && (
        <ListRow
          title={`${o.amount_uzs.toLocaleString("ru-RU")} so'm`}
          subtitle="Narx"
        />
      )}
      {o.last4 && (
        <ListRow title={`•••• ${o.last4}`} subtitle="Karta" />
      )}
    </ListGroup>
  );

  return (
    <Screen
      padded
      title="Buyurtma"
      subtitle={<Badge variant={label.tone}>{label.text}</Badge>}
    >
      {/* The deadline comes first: on this screen it is the only thing that
          is time-critical, so it must not sit below the order details. */}
      {o.status === "awaiting_otp" && otpSecs !== null && (
        <div
          role="timer"
          aria-live={otpUrgent ? "assertive" : "off"}
          className={cn(
            "rounded-2xl border p-4 transition-colors duration-500",
            otpUrgent
              ? "border-error/40 bg-error/10"
              : "border-coral/30 bg-coral/10",
          )}
        >
          <div className="flex items-center gap-3">
            <Clock
              className={cn("h-6 w-6 shrink-0", otpUrgent ? "text-error" : "text-coral")}
              strokeWidth={1.75}
            />
            <div className="min-w-0 flex-1">
              <div className="text-body-sm text-muted">
                {otpOver ? "Vaqt tugadi" : "Telefoningizga kelgan kodni kiriting"}
              </div>
              <div
                className={cn(
                  "mt-1 font-mono text-display-xl font-medium tabular-nums leading-none",
                  otpUrgent ? "text-error" : "text-ink",
                  otpUrgent && !otpOver && "motion-safe:animate-pulse",
                )}
              >
                {formatMmSs(otpSecs)}
              </div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-pill bg-hairline-soft">
            <div
              className={cn(
                "h-full rounded-pill transition-[width] duration-1000 ease-linear",
                otpUrgent ? "bg-error" : "bg-coral",
              )}
              style={{
                width: `${otpWindow.current ? (otpSecs / otpWindow.current) * 100 : 0}%`,
              }}
            />
          </div>
          {otpUrgent && !otpOver && (
            <p className="mt-2 text-body-sm text-error">
              Shoshiling — vaqt tugasa, bron bekor bo'ladi.
            </p>
          )}
        </div>
      )}

      {justPaid && o.status === "paid" && (
        <PrintedTicket
          train={o.train_number}
          car={o.car_number}
          seats={seats.join(", ")}
          date={formatTravelDate(o.travel_date)}
        />
      )}

      {o.status !== "awaiting_otp" && details}

      {o.status === "awaiting_otp" && (
        <>
          <div className="space-y-1">
            <Label htmlFor="otp">SMS kod</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
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
              before={<KeyRound size={16} strokeWidth={1.75} />}
            />
            {otpError && (
              <p
                id="otp-error"
                role="alert"
                className="flex items-start gap-1.5 px-1 text-body-sm text-error"
              >
                <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
                {otpError}
              </p>
            )}
            {!otpError && o.failure_reason && o.otp_attempts ? (
              // The backend's own account of the last attempt (e.g. "not
              // settled yet — retype if it was wrong, wait if it was right").
              <p className="flex items-start gap-1.5 px-1 text-body-sm text-muted">
                <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
                {o.failure_reason}
              </p>
            ) : null}
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
              onClick={() => resend.mutate()}
              disabled={resend.isPending}
            >
              <RefreshCw size={14} strokeWidth={1.75} />
              SMS'ni qayta yuborish
            </Button>
          </div>

          {details}

          <StickyAction
            hint={
              otpOver ? "Vaqt tugadi — buyurtma yopilmoqda"
                : otpDigits.length < 3 ? "Kod kiriting"
                : undefined
            }
          >
            <div className="flex flex-col gap-2">
              <Button
                full
                disabled={otpDigits.length < 3 || submit.isPending || otpOver}
                onClick={() => submit.mutate(otpDigits)}
              >
                {submit.isPending ? "Yuborilmoqda…" : "Tasdiqlash"}
              </Button>
              <Button
                full
                variant="destructive"
                disabled={cancel.isPending}
                onClick={async () => {
                  if (await showConfirm("Buyurtmani bekor qilishni xohlaysizmi?")) {
                    cancel.mutate();
                  }
                }}
              >
                <X size={16} strokeWidth={1.75} />
                Buyurtmani bekor qilish
              </Button>
            </div>
          </StickyAction>
        </>
      )}

      {o.status === "reserving" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Spinner />
          <div className="text-body-sm text-muted">Bron qilinmoqda…</div>
          <Button variant="secondary" onClick={() => navigate("/orders")}>
            Buyurtmalar
          </Button>
        </div>
      )}

      {o.status === "paying" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Spinner />
          <div className="text-body-md text-ink">
            {o.otp_confirmed_at ? "Kod qabul qilingan" : "To'lov tekshirilmoqda…"}
          </div>
          <p className="max-w-sm text-center text-body-sm text-muted">
            {o.failure_reason
              ?? "eticket to'lovni tasdiqlashi bir necha soniya olishi mumkin. Kod noto'g'ri bo'lsa, qaytadan kiritish uchun shu yerga qaytasiz."}
          </p>
          <Button
            variant="destructive"
            disabled={cancel.isPending}
            onClick={async () => {
              if (await showConfirm("Buyurtmani bekor qilishni xohlaysizmi?")) {
                cancel.mutate();
              }
            }}
          >
            <X size={16} strokeWidth={1.75} />
            Buyurtmani bekor qilish
          </Button>
        </div>
      )}

      {o.status === "paid" && (
        <div className="flex flex-col items-center gap-3 py-6">
          {!justPaid && <CheckCircle2 className="h-12 w-12 text-coral" strokeWidth={1.5} />}
          <div className="text-title-md text-ink">Chipta sotib olindi!</div>
          <p className="text-body-sm text-muted text-center">
            Chipta eticket.railway.uz akkountingizdagi
            "Mening yangi buyurtmalarim"da ko'rinadi.
          </p>
          <Button variant="secondary" onClick={() => navigate("/orders", { replace: true })}>
            Buyurtmalar
          </Button>
        </div>
      )}

      {(o.status === "failed" || o.status === "expired" || o.status === "cancelled") && (
        <div className="flex flex-col items-center gap-3 py-6">
          <XCircle className="h-12 w-12 text-muted-soft" strokeWidth={1.5} />
          <div className="text-title-md text-ink">{label.text}</div>
          {o.failure_reason && (
            <p className="text-body-sm text-muted text-center max-w-sm">{o.failure_reason}</p>
          )}
          <Button variant="secondary" onClick={() => navigate("/home")}>
            Bosh sahifaga
          </Button>
        </div>
      )}
    </Screen>
  );
}
