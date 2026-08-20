import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin, CalendarDays, TrainFront, Armchair, ArrowDownToLine, ArrowUpToLine,
  Check, CreditCard, Link2, Users, Zap,
} from "lucide-react";

import {
  createSubscription, getCard, getFriends, getRailwayStatus, patchAutobuy,
} from "@/api/client";
import { useHaptic } from "@/hooks/useHaptic";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Spinner } from "@/components/ui/spinner";

const MAX_PASSENGERS = 4;

export function Confirm() {
  useWizardGuard(["dep_code", "arr_code", "travel_date", "train_numbers", "car_types"]);

  const navigate = useNavigate();
  const qc = useQueryClient();
  const haptic = useHaptic();
  const w = useWizard();
  const autobuy = w.autobuy_enabled;
  const friendIds = w.autobuy_friend_ids;

  const accountQ = useQuery({ queryKey: ["railwayAccount"], queryFn: getRailwayStatus });
  const linked = accountQ.data?.linked === true;
  const friendsQ = useQuery({
    queryKey: ["friends"], queryFn: getFriends, enabled: autobuy && linked,
  });
  const cardQ = useQuery({ queryKey: ["card"], queryFn: getCard, enabled: autobuy });

  const friends = friendsQ.data ?? [];
  const validCount = friendIds.filter(id => friends.some(f => f.id === id)).length;
  const hasCard = !!cardQ.data;
  const autobuyReady = !autobuy || (linked && validCount >= 1 && hasCard);

  const toggleFriend = (id: number) =>
    w.setField(
      "autobuy_friend_ids",
      friendIds.includes(id)
        ? friendIds.filter(x => x !== id)
        : friendIds.length >= MAX_PASSENGERS
          ? friendIds
          : [...friendIds, id],
    );

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
      // Mark the wizard finished, then go straight Home. The flag makes every
      // /new/* route self-evict (see useWizardGuard), so back-stepping can
      // never resurrect a completed wizard — counting history entries to
      // unwind was unreliable, because `replace` navigations bump the counter
      // without adding an entry, so it could jump back past the app entirely.
      w.setField("completed", true);
      navigate("/home", { replace: true });
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
          title={w.car_types.join(", ")}
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

          <ListGroup
            label={`Yo'lovchilar${validCount ? ` · ${validCount}/${MAX_PASSENGERS}` : ""}`}
            footer={`Bir vagondan ${MAX_PASSENGERS} tagacha yonma-yon joy izlanadi.`}
          >
            {friendsQ.isLoading ? (
              <ListRow title="Yuklanmoqda…" />
            ) : friends.length === 0 ? (
              <ListRow
                before={<Users className="h-5 w-5 text-muted-soft" strokeWidth={1.75} />}
                title="Hamroh yo'q"
                subtitle="Avval eticket'da hamroh qo'shing"
                onClick={() => navigate("/friends")}
                chevron
              />
            ) : (
              <div className="flex flex-col">
                {friends.map(f => {
                  const checked = friendIds.includes(f.id);
                  const atMax = !checked && friendIds.length >= MAX_PASSENGERS;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={atMax}
                      onClick={() => toggleFriend(f.id)}
                      className="flex items-center gap-3 px-4 py-3 text-left active:bg-hairline-soft transition-colors min-h-[56px] border-b border-hairline-soft last:border-b-0 disabled:opacity-40"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
                          checked ? "border-coral bg-coral text-on-primary" : "border-muted-soft"
                        }`}
                        aria-hidden
                      >
                        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-body-md font-medium truncate text-ink">
                          {`${f.firstname} ${f.lastname}`.trim()}
                        </div>
                        <div className="text-body-sm text-muted truncate">
                          {f.is_self ? "Men · " : ""}
                          {f.doc_type ?? ""}
                          {f.doc_masked ? ` ${f.doc_masked}` : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ListGroup>
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
