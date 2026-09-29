import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { CreditCard, Link2, Zap } from "lucide-react";

import {
  getCard,
  getFriends,
  getRailwayStatus,
  listSubscriptions,
  patchAutobuy,
  type PaymentMethod,
  type SeatStrategy,
} from "@/api/client";
import { PassengerPicker, SeatStrategyGroup } from "@/components/PassengerPicker";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { IconTile } from "@/components/ui/tile";
import { useHaptic } from "@/hooks/useHaptic";
import { spring } from "@/lib/motion";
import { MAX_SEATED, passengerProblem } from "@/lib/passengers";

const MAX_PASSENGERS = MAX_SEATED;

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "hamkorbank", label: "Humo / Uzcard", hint: "Saqlangan karta orqali (tavsiya etiladi)" },
  { value: "payme",      label: "Payme",         hint: "Payme karta yoki balans" },
];

/** A text line's stand-in while its value loads. */
const Bar = ({ w }: { w: string }) => (
  <Skeleton className="my-[3px] h-3.5 rounded-full bg-ink/[0.07]" style={{ width: w }} />
);

/**
 * One payment method: a real radio, labelled by the whole row. Drawn like a
 * <ListRow> (height, press tint, hairline from the text edge) but it is a
 * <label>, so a tap anywhere on it picks the radio.
 */
function PayRow({ value, label, hint }: { value: PaymentMethod; label: string; hint: string }) {
  const id = `pm-${value}`;
  return (
    <label
      htmlFor={id}
      className={
        "tap relative flex min-h-[52px] cursor-pointer items-center gap-3.5 px-4 py-2.5 " +
        "transition-colors duration-150 active:bg-[color:var(--row-press)] " +
        "after:pointer-events-none after:absolute after:bottom-0 after:left-[54px] after:right-0 after:h-px after:bg-hairline-soft last:after:hidden"
      }
    >
      <RadioGroupItem id={id} value={value} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body-md text-ink">{label}</div>
        <div className="mt-px text-body-sm text-muted">{hint}</div>
      </div>
    </label>
  );
}

export function AutobuyConfig() {
  const { id } = useParams<{ id: string }>();
  const subId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const haptic = useHaptic();

  const accountQ = useQuery({ queryKey: ["railwayAccount"], queryFn: getRailwayStatus });
  const subsQ = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });
  const friendsQ = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
    enabled: accountQ.data?.linked === true,
  });
  const cardQ = useQuery({ queryKey: ["card"], queryFn: getCard });

  const sub = subsQ.data?.subscriptions.find(s => s.id === subId);

  const [enabled, setEnabled] = useState<boolean>(false);
  const [friendIds, setFriendIds] = useState<number[]>([]);
  const [lapIds, setLapIds] = useState<number[]>([]);
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  const [strategy, setStrategy] = useState<SeatStrategy>("all");

  // Seed local state when the subscription loads.
  useEffect(() => {
    if (sub) {
      setEnabled(sub.autobuy_enabled);
      setFriendIds(
        sub.autobuy_friend_ids?.length
          ? sub.autobuy_friend_ids
          : sub.autobuy_friend_id != null
            ? [sub.autobuy_friend_id]
            : [],
      );
      setLapIds(sub.autobuy_lap_child_ids ?? []);
      setPayMethod(sub.autobuy_payment_method);
      setStrategy(sub.autobuy_seat_strategy ?? "all");
    }
  }, [sub?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () =>
      patchAutobuy(subId, {
        enabled,
        friend_ids: enabled ? friendIds : null,
        payment_method: enabled ? payMethod : null,
        seat_strategy: enabled ? strategy : null,
        lap_child_ids: enabled ? lapIds : null,
      }),
    onSuccess: () => {
      haptic.notify("success");
      toast.success("Saqlandi");
      qc.invalidateQueries({ queryKey: ["subs"] });
      navigate(`/sub/${subId}`);
    },
    onError: (err: any) => {
      haptic.notify("error");
      const code = err?.response?.data?.error?.code;
      if (code === "railway_account_required") {
        toast.error("Avval eticket akkountni ulang");
        navigate("/railway-link");
      } else if (code === "invalid_payload") {
        const inner = err?.response?.data?.error?.details?.code;
        if (inner === "friend_not_owned") toast.error("Hamroh topilmadi");
        else toast.error("Forma noto'g'ri to'ldirildi");
      } else {
        toast.error("Saqlashda xato");
      }
    },
  });

  if (subsQ.isLoading || accountQ.isLoading) return <StatusView kind="loading" />;
  if (!sub) {
    return (
      <StatusView
        kind="empty"
        header="Topilmadi"
        description="Bu xabarnoma o'chirilgan yoki mavjud emas."
      />
    );
  }
  if (!accountQ.data?.linked) {
    return (
      <StatusView
        kind="empty"
        header="Akkount ulanmagan"
        description="Auto-buy uchun avval eticket.railway.uz akkountingizni ulang."
        action={
          <Button onClick={() => navigate("/railway-link")}>
            <Link2 strokeWidth={2.2} />
            Akkountni ulash
          </Button>
        }
      />
    );
  }

  const friends = friendsQ.data ?? [];
  const validCount = friendIds.filter(id => friends.some(f => f.id === id)).length;
  const problem = passengerProblem(friends, sub.travel_date, friendIds, lapIds);
  const canSave =
    !save.isPending &&
    (!enabled ||
      (validCount >= 1 && validCount <= MAX_PASSENGERS && !problem && cardQ.data !== null));

  return (
    <Screen
      padded
      title="Avto sotib olish"
      subtitle={`${sub.dep_name} → ${sub.arr_name} · ${sub.travel_date}`}
    >
      {/* The switch, then — only while it is on — everything auto-buy needs. */}
      <div className="space-y-6">
        <ListGroup
          label="Holat"
          footer={enabled
            ? "Chipta topilganda avtomatik bron qilinadi"
            : "Hozircha faqat xabar yuboriladi"}
        >
          <ListRow
            before={<IconTile icon={Zap} tone={enabled ? "coral" : "gray"} />}
            title="Auto-buy yoqilgan"
            after={
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label="Auto-buy"
              />
            }
          />
        </ListGroup>

        <AnimatePresence initial={false}>
          {enabled && (
            <m.div
              key="autobuy"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: spring.smooth }}
              exit={{ opacity: 0, y: 8, transition: spring.snappy }}
              className="space-y-6"
            >
              <ListGroup label="To'lov kartasi" footer="Karta auto-buy paytida avtomatik yuboriladi">
                <ListRow
                  before={<IconTile icon={CreditCard} tone={cardQ.data ? "coral" : "gray"} />}
                  title={
                    cardQ.isLoading ? <Bar w="7rem" />
                      : cardQ.data ? <span className="tnum">{`•••• ${cardQ.data.last4}`}</span>
                      : "Karta saqlanmagan"
                  }
                  subtitle={
                    cardQ.isLoading ? <Bar w="5rem" />
                      : cardQ.data ? "Saqlangan"
                      : "Avval kartani saqlash kerak"
                  }
                  onClick={() => navigate("/cards/add")}
                  chevron
                />
              </ListGroup>

              <PassengerPicker
                friends={friends}
                travelDate={sub.travel_date}
                seatedIds={friendIds}
                lapIds={lapIds}
                loading={friendsQ.isLoading}
                onChange={(seated, lap) => { setFriendIds(seated); setLapIds(lap); }}
                onAddFriend={() => navigate("/friends")}
              />

              {validCount > 1 && <SeatStrategyGroup value={strategy} onChange={setStrategy} />}

              <ListGroup label="To'lov uslubi (ixtiyoriy)" footer="Tanlanmasa, bron paytida tanlaysiz">
                <RadioGroup
                  aria-label="To'lov uslubi"
                  value={payMethod ?? ""}
                  onValueChange={v => { haptic.selection(); setPayMethod(v as PaymentMethod); }}
                  className="gap-0"
                >
                  {PAYMENT_OPTIONS.map(o => (
                    <PayRow key={o.value} value={o.value} label={o.label} hint={o.hint} />
                  ))}
                </RadioGroup>
              </ListGroup>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <StickyAction
        hint={
          enabled && !cardQ.data
            ? "Avval karta saqlang"
            : enabled && validCount < 1
              ? "Kamida bitta yo'lovchi tanlang"
              : enabled && problem
                ? problem
                : undefined
        }
      >
        <Button
          full
          size="lg"
          loading={save.isPending}
          disabled={!canSave}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saqlanyapti…" : "Saqlash"}
        </Button>
      </StickyAction>
    </Screen>
  );
}
