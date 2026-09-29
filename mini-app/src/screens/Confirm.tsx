import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import {
  MapPin, CalendarDays, TrainFront, Armchair, ArrowDownToLine, ArrowUpToLine,
  CreditCard, Link2, Zap,
} from "lucide-react";

import {
  createSubscription, getCard, getFriends, getRailwayStatus, patchAutobuy,
} from "@/api/client";
import { carTypeLabels } from "@/lib/cartypes";
import { spring } from "@/lib/motion";
import { passengerProblem } from "@/lib/passengers";
import { useHaptic } from "@/hooks/useHaptic";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { PassengerPicker, SeatStrategyGroup } from "@/components/PassengerPicker";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { IconTile } from "@/components/ui/tile";

/** A text line's stand-in while its value loads. */
const Bar = ({ w }: { w: string }) => (
  <Skeleton className="my-[3px] h-3.5 rounded-full bg-ink/[0.07]" style={{ width: w }} />
);

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
      {/* What will be watched. Every row jumps back to the step that set it.
          Tile tones are fixed hues except route (primary) and car (amber), so
          no two rows share a colour in any palette. */}
      <ListGroup footer="Bo'sh joy paydo bo'lganda Telegram orqali darhol xabar olasiz.">
        <ListRow
          before={<IconTile icon={MapPin} tone="coral" />}
          title={`${w.dep_name} → ${w.arr_name}`}
          subtitle="Marshrut"
          chevron
          onClick={() => navigate("/new")}
        />
        <ListRow
          before={<IconTile icon={CalendarDays} tone="blue" />}
          title={<span className="tnum">{w.travel_date ?? ""}</span>}
          subtitle="Sana"
          chevron
          onClick={() => navigate("/new/date")}
        />
        <ListRow
          before={<IconTile icon={TrainFront} tone="violet" />}
          title={w.train_numbers.length ? w.train_numbers.join(", ") : "Har qanday"}
          subtitle={w.train_numbers.length > 1 ? `Poyezdlar · ${w.train_numbers.length} ta` : "Poyezd"}
          chevron
          onClick={() => navigate("/new/train")}
        />
        <ListRow
          before={<IconTile icon={Armchair} tone="amber" />}
          title={carTypeLabels(w.car_types)}
          subtitle="Vagon turi"
          chevron
          onClick={() => navigate("/new/car-type")}
        />
        {berthLabel && (
          <ListRow
            before={<IconTile icon={BerthIcon} tone="pink" />}
            title={berthLabel}
            subtitle="Joy turi"
            chevron
            onClick={() => navigate("/new/berth")}
          />
        )}
      </ListGroup>

      {/* Auto-buy. Off, it is one switch; on, what it needs rises in below. */}
      <div className="space-y-6">
        <ListGroup
          label="Avto sotib olish"
          footer={
            autobuy
              ? undefined
              : "Yoqilsa, joy topilgan zahoti chipta o'zi bron qilinadi — sizga faqat SMS kod kerak bo'ladi."
          }
        >
          <ListRow
            before={<IconTile icon={Zap} tone={autobuy ? "coral" : "gray"} />}
            title="Avtomatik sotib olish"
            subtitle={autobuy ? "Yoqilgan" : "Faqat xabar yuboriladi"}
            after={
              <Switch
                checked={autobuy}
                onCheckedChange={v => w.setField("autobuy_enabled", v)}
                aria-label="Avto sotib olish"
              />
            }
          />
        </ListGroup>

        <AnimatePresence initial={false}>
          {autobuy && (
            <m.div
              key="autobuy"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: spring.smooth }}
              exit={{ opacity: 0, y: 8, transition: spring.snappy }}
              className="space-y-6"
            >
              {accountQ.isLoading ? (
                <ListGroup aria-busy="true">
                  <ListRow
                    before={<IconTile icon={Link2} tone="gray" soft />}
                    title={<Bar w="8rem" />}
                    subtitle={<Bar w="6rem" />}
                  />
                </ListGroup>
              ) : !linked ? (
                <ListGroup label="eticket akkount" footer="Auto-buy uchun akkount ulanishi shart.">
                  <ListRow
                    before={<IconTile icon={Link2} tone="coral" />}
                    title="Akkountni ulash"
                    subtitle="eticket.railway.uz"
                    onClick={() => navigate("/railway-link")}
                    chevron
                  />
                </ListGroup>
              ) : (
                <>
                  <ListGroup label="To'lov kartasi">
                    <ListRow
                      before={<IconTile icon={CreditCard} tone={hasCard ? "coral" : "gray"} />}
                      title={
                        cardQ.isLoading ? <Bar w="7rem" />
                          : hasCard ? <span className="tnum">{`•••• ${cardQ.data!.last4}`}</span>
                          : "Karta saqlanmagan"
                      }
                      subtitle={
                        cardQ.isLoading ? <Bar w="5rem" />
                          : hasCard ? "Saqlangan"
                          : "Qo'shish uchun bosing"
                      }
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
                    <SeatStrategyGroup
                      value={w.autobuy_seat_strategy}
                      onChange={v => w.setField("autobuy_seat_strategy", v)}
                    />
                  )}
                </>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>

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
          size="lg"
          loading={mutation.isPending}
          disabled={!autobuyReady}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? "Saqlanmoqda..."
            : autobuy
              ? "Saqlash va yoqish"
              : "Saqlash"}
        </Button>
      </StickyAction>
    </Screen>
  );
}
