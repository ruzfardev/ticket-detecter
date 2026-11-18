import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin, CalendarDays, TrainFront, Armchair, ArrowDownToLine, ArrowUpToLine,
  Check, CreditCard, Link2, Zap,
} from "lucide-react";

import {
  createSubscription, deleteSubscription, getCard, getFriends, getRailwayStatus,
  listOrders, listSubscriptions, patchAutobuy, patchSubscription,
  type Subscription,
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
  // Auto-buy on "any train" would buy the first train that shows up, whatever
  // its time or route. Not offered here; the user can turn it on later from the
  // subscription once the trains are out.
  const anyTrain = w.any_train && w.train_numbers.length === 0;
  const autobuy = w.autobuy_enabled && !anyTrain;
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

  const editingId = w.editing_sub_id;
  const subsQ = useQuery({
    queryKey: ["subs"], queryFn: listSubscriptions, enabled: editingId !== null,
  });
  const original = subsQ.data?.subscriptions.find(s => s.id === editingId);

  const createSub = async (): Promise<Subscription> => {
    if (!w.dep_code || !w.arr_code || !w.travel_date) {
      throw new Error("incomplete_wizard");
    }
    return createSubscription({
      dep_code: w.dep_code,
      arr_code: w.arr_code,
      travel_date: w.travel_date,
      train_numbers: w.train_numbers,
      car_types: w.car_types,
      berth: w.berth,
    });
  };

  // Arm auto-buy as part of the same save so the user never lands on a
  // subscription that says "auto-buy on" but isn't actually armed.
  const armAutobuy = async (subId: number): Promise<void> => {
    if (!autobuy) return;
    await patchAutobuy(subId, {
      enabled: true,
      friend_ids: friendIds,
      payment_method: w.autobuy_payment_method,
      seat_strategy: w.autobuy_seat_strategy,
      lap_child_ids: lapIds,
    });
  };

  /**
   * The backend cannot change a subscription's route or filters in place, so
   * an edit is "create the edited copy, then retire the original":
   *   1. pause the original, which frees its slot for the copy
   *   2. create the copy; on any failure undo both steps, so the user is left
   *      exactly where they started
   *   3. delete the original, unless it has auto-buy orders: deleting a
   *      subscription cascades to its orders, which would wipe the user's
   *      purchase history from Buyurtmalar. Such an original stays paused.
   */
  const replaceOriginal = async (): Promise<{ kept: boolean }> => {
    const id = editingId!;
    const wasActive = original?.is_active ?? true;
    if (wasActive) await patchSubscription(id, { is_active: false });
    let copy: Subscription | null = null;
    try {
      copy = await createSub();
      await armAutobuy(copy.id);
    } catch (e) {
      if (copy) await deleteSubscription(copy.id).catch(() => {});
      if (wasActive) await patchSubscription(id, { is_active: true }).catch(() => {});
      throw e;
    }
    const orders = await listOrders().catch(() => null);
    // If the order list could not be read, keep the original: a paused extra
    // is a nuisance, lost purchase history is not recoverable.
    const hasHistory = orders === null || orders.some(o => o.subscription_id === id);
    if (hasHistory) return { kept: true };
    await deleteSubscription(id).catch(() => {});
    return { kept: false };
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (editingId !== null) return replaceOriginal();
      const sub = await createSub();
      await armAutobuy(sub.id);
      return { kept: false };
    },
    onSuccess: ({ kept }) => {
      haptic.notify("success");
      qc.invalidateQueries({ queryKey: ["subs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      if (editingId !== null) {
        qc.invalidateQueries({ queryKey: ["orders"] });
        toast.success(
          kept
            ? "Saqlandi. Eski nusxa buyurtmalar tarixi uchun pauzada qoldi."
            : "O'zgarishlar saqlandi",
        );
        w.setField("completed", true);
        navigate("/home", { replace: true });
        return;
      }
      toast.success(autobuy ? "Yaratildi — auto-buy yoqildi" : "Xabarnoma yaratildi");
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
      title={editingId !== null ? "Tahrirlash" : "Tasdiqlash"}
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
          title={w.train_numbers.length ? w.train_numbers.join(", ") : "Istalgan poyezd"}
          subtitle={w.train_numbers.length > 1 ? `Poyezdlar · ${w.train_numbers.length} ta` : "Poyezd"}
          chevron
          onClick={() => navigate("/new/train")}
        />
        <ListRow
          before={<Armchair className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={w.car_types.length ? carTypeLabels(w.car_types) : "Istalgan vagon"}
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

      {anyTrain ? (
        <ListGroup
          label="Avto sotib olish"
          footer="Istalgan poyezd tanlanganda avto sotib olish o'chiq turadi — aks holda chipta siz kutmagan poyezdga olinishi mumkin. Poyezdlar chiqqach, aniq poyezd bilan yangi xabarnoma yaratib, uni yoqishingiz mumkin."
        >
          <ListRow
            before={<Zap className="h-5 w-5 text-muted-soft" strokeWidth={1.75} />}
            title="Avtomatik sotib olish"
            subtitle="Faqat xabar yuboriladi"
          />
        </ListGroup>
      ) : (
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
      )}

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
        {anyTrain
          ? "Poyezdlar chiqib, bo'sh joy paydo bo'lishi bilan Telegram orqali xabar olasiz. Bir nechta poyezd ochilsa, har biri uchun alohida xabar keladi."
          : "Bo'sh joy paydo bo'lganda Telegram orqali darhol xabar olasiz."}
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
          ) : editingId !== null ? (
            "O'zgarishlarni saqlash"
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
