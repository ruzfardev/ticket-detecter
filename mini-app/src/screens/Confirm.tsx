import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin, CalendarDays, TrainFront, Armchair, ArrowDownToLine, ArrowUpToLine,
  Check, CreditCard, Link2, Zap,
} from "lucide-react";

import {
  createSubscription, getCard, getFriends, getRailwayStatus, patchAutobuy,
} from "@/api/client";
import { carTypeLabels } from "@/lib/cartypes";
import { MAX_SEATED, passengerProblem } from "@/lib/passengers";
import { useHaptic } from "@/hooks/useHaptic";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { PassengerPicker } from "@/components/PassengerPicker";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Spinner } from "@/components/ui/spinner";

const MAX_PASSENGERS = MAX_SEATED;

export function Confirm() {
  useWizardGuard(["dep_code", "arr_code", "travel_date", "train_numbers", "car_types"]);

  const navigate = useNavigate();
  const qc = useQueryClient();
  const haptic = useHaptic();
  const w = useWizard();
  const autobuy = w.autobuy_enabled;
  const friendIds = w.autobuy_friend_ids;
  const lapIds = w.autobuy_lap_child_ids ?? [];

  const accountQ = useQuery({ queryKey: ["railwayAccount"], queryFn: getRailwayStatus });
  const linked = accountQ.data?.linked === true;
  const friendsQ = useQuery({
    queryKey: ["friends"], queryFn: getFriends, enabled: autobuy && linked,
  });
  const cardQ = useQuery({ queryKey: ["card"], queryFn: getCard, enabled: autobuy });

  const friends = friendsQ.data ?? [];
  const validCount = friendIds.filter(id => friends.some(f => f.id === id)).length;
  const hasCard = !!cardQ.data;
  const problem = passengerProblem(friends, w.travel_date, friendIds, lapIds);
  const autobuyReady = !autobuy || (linked && validCount >= 1 && !problem && hasCard);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!w.dep_code || !w.arr_code || !w.travel_date) {
        throw new Error("incomplete_wizard");
      }
      const sub = await createSubscription({
        dep_code: w.dep_code,
        arr_code: w.arr_code,
        travel_date: w.travel_date,
        train_numbers: w.train_numbers,
        car_types: w.car_types,
        berth: w.berth,
      });
      // Arm auto-buy as part of the same save so the user never lands on a
      // subscription that says "auto-buy on" but isn't actually armed.
      if (autobuy) {
        await patchAutobuy(sub.id, {
          enabled: true,
          friend_ids: friendIds,
          payment_method: w.autobuy_payment_method,
          seat_strategy: w.autobuy_seat_strategy,
          lap_child_ids: lapIds,
        });
      }
      return sub;
    },
    onSuccess: () => {
      haptic.notify("success");
      toast.success(autobuy ? "Yaratildi — auto-buy yoqildi" : "Xabarnoma yaratildi");
      qc.invalidateQueries({ queryKey: ["subs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      // NOTE: do not reset() here — clearing the wizard while Confirm is still
      // mounted makes useWizardGuard see empty fields and bounce to step 1.
      // handleNew() in Home resets on the next wizard entry instead.
      //
      // Mark the wizard finished, then go straight to Buyurtmalar. The flag
      // makes every /new/* route self-evict (see useWizardGuard), so
      // back-stepping can never resurrect a completed wizard — counting
      // history entries to unwind was unreliable, because `replace`
      // navigations bump the counter without adding an entry, so it could
      // jump back past the app entirely.
      w.setField("completed", true);
      navigate("/orders", { replace: true });
    },
    onError: (err: any) => {
      haptic.notify("error");
      const code = err.response?.data?.error?.code;
      if (code === "slot_limit_reached") {
        toast.error("Slot to'lgan. Premium kerak.");
        setTimeout(() => navigate("/premium"), 800);
      } else {
        toast.error(err.response?.data?.error?.message || err.message || "Saqlanmadi");
      }
    },
  });

  const BerthIcon = w.berth === "lower" ? ArrowDownToLine : ArrowUpToLine;
  const berthLabel =
    w.berth === "lower" ? "Pastki" :
    w.berth === "upper" ? "Tepa" :
    null;

  return (
    <Screen
      padded
      wizard
      title="Tasdiqlash"
      subtitle="O'zgartirish uchun qatorga bosing"
    >
      <ListGroup>
        <ListRow
          before={<MapPin className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={`${w.dep_name} → ${w.arr_name}`}
          subtitle="Marshrut"
          chevron
          onClick={() => navigate("/new")}
        />
        <ListRow
          before={<CalendarDays className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={w.travel_date ?? ""}
          subtitle="Sana"
          chevron
          onClick={() => navigate("/new/date")}
        />
        <ListRow
          before={<TrainFront className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={w.train_numbers.length ? w.train_numbers.join(", ") : "Har qanday"}
          subtitle={w.train_numbers.length > 1 ? `Poyezdlar · ${w.train_numbers.length} ta` : "Poyezd"}
          chevron
          onClick={() => navigate("/new/train")}
        />
        <ListRow
          before={<Armchair className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={carTypeLabels(w.car_types)}
          subtitle="Vagon turi"
          chevron
          onClick={() => navigate("/new/car-type")}
        />
        {berthLabel && (
          <ListRow
            before={<BerthIcon className="h-5 w-5 text-ink" strokeWidth={1.75} />}
            title={berthLabel}
            subtitle="Joy turi"
            chevron
            onClick={() => navigate("/new/berth")}
          />
        )}
      </ListGroup>

      <ListGroup
        label="Avto sotib olish"
        footer={
          autobuy
            ? undefined
            : "Yoqilsa, joy topilgan zahoti chipta o'zi bron qilinadi — sizga faqat SMS kod kerak bo'ladi."
        }
      >
        <ListRow
          before={
            <Zap
              className={`h-5 w-5 ${autobuy ? "text-coral" : "text-muted-soft"}`}
              strokeWidth={1.75}
            />
          }
          title="Avtomatik sotib olish"
          subtitle={autobuy ? "Yoqilgan" : "Faqat xabar yuboriladi"}
          after={
            <input
              type="checkbox"
              checked={autobuy}
              onChange={e => w.setField("autobuy_enabled", e.target.checked)}
              className="h-5 w-5 accent-coral"
              aria-label="Avto sotib olish"
            />
          }
        />
      </ListGroup>

      {autobuy && !linked && (
        <ListGroup label="eticket akkount" footer="Auto-buy uchun akkount ulanishi shart.">
          <ListRow
            before={<Link2 className="h-5 w-5 text-coral" strokeWidth={1.75} />}
            title="Akkountni ulash"
            subtitle="eticket.railway.uz"
            onClick={() => navigate("/railway-link")}
            chevron
          />
        </ListGroup>
      )}

      {autobuy && linked && (
        <>
          <ListGroup label="To'lov kartasi">
            <ListRow
              before={
                <CreditCard
                  className={`h-5 w-5 ${hasCard ? "text-coral" : "text-muted-soft"}`}
                  strokeWidth={1.75}
                />
              }
              title={hasCard ? `•••• ${cardQ.data!.last4}` : "Karta saqlanmagan"}
              subtitle={hasCard ? "Saqlangan" : "Qo'shish uchun bosing"}
              onClick={() => navigate("/cards/add")}
              chevron
            />
          </ListGroup>

          <PassengerPicker
            friends={friends}
            travelDate={w.travel_date}
            seatedIds={friendIds}
            lapIds={lapIds}
            loading={friendsQ.isLoading}
            onChange={(seated, lap) => {
              w.setField("autobuy_friend_ids", seated);
              w.setField("autobuy_lap_child_ids", lap);
            }}
            onAddFriend={() => navigate("/friends")}
          />

          {validCount > 1 && (
            <ListGroup
              label="Joy yetmasa"
              footer={
                w.autobuy_seat_strategy === "partial"
                  ? "Nechta joy bo'lsa, shuncha olinadi. Qolganlari uchun kuzatuv davom etadi."
                  : "Hamma yo'lovchiga bitta vagondan joy topilmaguncha kutiladi."
              }
            >
              {([
                { v: "all" as const, t: "Hammasi birga", d: "Yoki hech nima — guruh ajralmaydi" },
                { v: "partial" as const, t: "Nechta bo'lsa, shuncha", d: "Kamida bittasini kafolatlash" },
              ]).map(o => (
                <ListRow
                  key={o.v}
                  before={
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border ${
                        w.autobuy_seat_strategy === o.v
                          ? "border-coral bg-coral text-on-primary"
                          : "border-muted-soft"
                      }`}
                      aria-hidden
                    >
                      {w.autobuy_seat_strategy === o.v && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                  }
                  title={o.t}
                  subtitle={o.d}
                  selected={w.autobuy_seat_strategy === o.v}
                  onClick={() => w.setField("autobuy_seat_strategy", o.v)}
                />
              ))}
            </ListGroup>
          )}
        </>
      )}

      <p className="text-body-sm text-muted px-1">
        Bo'sh joy paydo bo'lganda Telegram orqali darhol xabar olasiz.
      </p>

      <StickyAction
        hint={
          !autobuy ? undefined
            : !linked ? "Avval eticket akkountni ulang"
            : !hasCard ? "Avval karta qo'shing"
            : validCount < 1 ? "Kamida bitta yo'lovchi tanlang"
            : undefined
        }
      >
        <Button
          full
          disabled={mutation.isPending || !autobuyReady}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" className="text-on-primary" />
              Saqlanmoqda...
            </span>
          ) : autobuy ? (
            "Saqlash va yoqish"
          ) : (
            "Saqlash"
          )}
        </Button>
      </StickyAction>
    </Screen>
  );
}
