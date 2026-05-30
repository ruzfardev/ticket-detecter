import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarDays, CheckCircle2, Clock, KeyRound, RefreshCw,
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
import { StickyAction } from "@/components/StickyAction";
import { useTelegram } from "@/hooks/useTelegram";

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

  const submit = useMutation({
    mutationFn: (code: string) => submitOrderOtp(orderId, code),
    onSuccess: () => {
      toast.success("To'lov muvaffaqiyatli");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code;
      if (code === "payment_failed") toast.error("OTP noto'g'ri yoki muddati o'tgan");
      else toast.error("Xato. Qaytadan urinib ko'ring");
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

  useEffect(() => { setOtp(""); }, [orderId]);

  if (order.isLoading) return <StatusView kind="loading" />;
  if (!order.data) return <StatusView kind="error" description="Buyurtma topilmadi" />;

  const o = order.data;
  const label = STATUS_LABEL[o.status];
  const otpDigits = otp.replace(/\D/g, "");

  return (
    <Screen
      padded
      title="Buyurtma"
      subtitle={<Badge variant={label.tone}>{label.text}</Badge>}
    >
      <ListGroup label="Tafsilotlar">
        <ListRow
          before={<TrainIcon className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={`${o.train_number} · Vagon ${o.car_number} · Joy ${o.seat_number}`}
        />
        <ListRow
          before={<CalendarDays className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={o.travel_date}
          subtitle="Sana"
        />
        {o.friend_name && (
          <ListRow title={o.friend_name} subtitle="Hamroh" />
        )}
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

      {o.status === "awaiting_otp" && (
        <>
          <ListGroup
            label="SMS-OTP kodi"
            footer={
              o.seconds_until_expiry !== null && o.seconds_until_expiry < 60
                ? "Muddat tugamoqda!"
                : "Telefoningizga kelgan kodni kiriting"
            }
          >
            <ListRow
              before={<Clock className="h-5 w-5 text-coral" strokeWidth={1.75} />}
              title={formatMmSs(o.seconds_until_expiry)}
              subtitle="Buyurtma bekor bo'lishi qoldi"
            />
          </ListGroup>
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
              onChange={e => setOtp(e.target.value)}
              before={<KeyRound size={16} strokeWidth={1.75} />}
            />
          </div>
          <div className="flex justify-end">
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

          <StickyAction
            hint={otpDigits.length < 3 ? "Kod kiriting" : undefined}
          >
            <div className="flex flex-col gap-2">
              <Button
                full
                disabled={otpDigits.length < 3 || submit.isPending}
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
        <div className="text-center text-body-sm text-muted">
          Bron qilinmoqda…
        </div>
      )}

      {o.status === "paying" && (
        <div className="text-center text-body-sm text-muted">
          To'lov ishlanmoqda…
        </div>
      )}

      {o.status === "paid" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle2 className="h-12 w-12 text-coral" strokeWidth={1.5} />
          <div className="text-title-md text-ink">Chipta sotib olindi!</div>
          <p className="text-body-sm text-muted text-center">
            Chipta eticket.railway.uz akkountingizdagi
            "Mening yangi buyurtmalarim"da ko'rinadi.
          </p>
          <Button variant="secondary" onClick={() => navigate("/home")}>
            Bosh sahifaga
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
