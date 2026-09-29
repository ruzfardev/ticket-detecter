import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as m from "motion/react-m";
import { Activity, CloudOff, Hourglass, TrainFront } from "lucide-react";

import { searchTrains, type Train } from "@/api/client";
import { useHaptic } from "@/hooks/useHaptic";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { insightText } from "@/lib/insight";
import { spring } from "@/lib/motion";
import { dayOffset, trainTime } from "@/lib/traintime";
import { cn } from "@/lib/utils";
import { EmptyNote } from "@/components/EmptyNote";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Ticker } from "@/components/motion/Ticker";
import { TripTimes } from "@/components/trip/TripTimes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PressCard } from "@/components/ui/press-card";
import { SelectMark } from "@/components/ui/select-mark";
import { Skeleton } from "@/components/ui/skeleton";

const som = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ");

/* ── One train ───────────────────────────────────────────────────────── */

/** Seats and the cheapest fare per car type, with what the watcher has seen
 *  under each — the one thing nobody else shows. One grid, so the numbers
 *  line up from row to row. */
function CarTypes({ t }: { t: Train }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 gap-y-1 text-body-sm">
      {t.car_types.map((c, i) => {
        const hint = insightText(c.insight);
        const none = c.free_seats === 0;
        const gap = i > 0 ? "pt-1.5" : "";
        return (
          <div key={c.type} className="contents">
            <span className={cn("truncate", none ? "text-muted" : "text-ink", gap)}>
              {c.label ?? c.type}
            </span>
            <span className={cn("tnum whitespace-nowrap text-right text-muted", gap)}>
              <b className={cn("font-semibold", none ? "text-muted" : "text-ink")}>{c.free_seats}</b> ta joy
            </span>
            <span className={cn("tnum whitespace-nowrap text-right text-caption text-muted", gap)}>
              {c.price_uzs ? (
                <>
                  <b className="font-semibold text-body">{som(c.price_uzs)}</b> so'm dan
                </>
              ) : null}
            </span>
            {hint && (
              <span className="col-span-3 flex items-start gap-1.5 text-caption text-muted">
                <Activity className="mt-[3px] size-3.5 shrink-0 text-coral-ink" strokeWidth={2.2} aria-hidden />
                <span className="min-w-0">{hint}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrainCard({ t, selected, onToggle }: { t: Train; selected: boolean; onToggle: () => void }) {
  const total = t.car_types.reduce((s, c) => s + c.free_seats, 0);
  return (
    <PressCard material="none" aria-pressed={selected} onClick={onToggle} className="rounded-[26px]">
      <div className={cn("surface p-4 transition-shadow duration-200", selected && "ring-select")}>
        {/* brand + number + selection state */}
        <div className="flex min-h-6 items-center gap-2">
          {t.brand && (
            <Badge variant="pill" className="text-body">{t.brand}</Badge>
          )}
          <span className="tnum truncate font-display text-title-lg text-ink">{t.number}</span>
          <SelectMark checked={selected} className="ml-auto" />
        </div>

        {/* stations + times, with the journey time on the line */}
        <TripTimes
          // RouteLine paints its duration chip with `bg-surface-strong`, which
          // is not a generated colour, so the dashes ran through the digits.
          className="mt-3"
          tone={selected ? "coral" : total === 0 ? "muted" : "ink"}
          duration={t.time_on_way || undefined}
          dep={{ station: t.dep_station, time: trainTime(t.departure) }}
          arr={{
            station: t.arr_station,
            time: trainTime(t.arrival),
            plus: dayOffset(t.departure, t.arrival),
          }}
        />

        <div className="mt-3.5 border-t border-hairline-soft pt-3">
          {t.car_types.length > 0 ? (
            <CarTypes t={t} />
          ) : (
            <p className="flex items-center gap-2 text-body-sm text-muted">
              <Hourglass className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              Chiptalar hali ochilmagan
            </p>
          )}
        </div>
      </div>
    </PressCard>
  );
}

/** Loading: cards with the real card's bones, so nothing jumps when it lands. */
function TrainCardSkeleton() {
  // The shimmer's own fill is the card's colour; tint the bones so they read.
  const bone = "bg-ink/[0.07]";
  return (
    <div className="surface p-4" aria-hidden>
      <div className="flex items-center gap-2">
        <Skeleton className={cn("h-[22px] w-[72px] rounded-full", bone)} />
        <Skeleton className={cn("h-5 w-14 rounded-md", bone)} />
        <Skeleton className={cn("ml-auto size-6 rounded-full", bone)} />
      </div>
      <div className="mt-3 flex items-end gap-3">
        <div className="space-y-2">
          <Skeleton className={cn("h-2.5 w-16 rounded-full", bone)} />
          <Skeleton className={cn("h-7 w-[74px] rounded-lg", bone)} />
        </div>
        <Skeleton className={cn("mb-[10px] h-[3px] flex-1 rounded-full", bone)} />
        <div className="flex flex-col items-end space-y-2">
          <Skeleton className={cn("h-2.5 w-16 rounded-full", bone)} />
          <Skeleton className={cn("h-7 w-[74px] rounded-lg", bone)} />
        </div>
      </div>
      <div className="mt-3.5 space-y-2.5 border-t border-hairline-soft pt-3.5">
        <Skeleton className={cn("h-3.5 w-full rounded-full", bone)} />
        <Skeleton className={cn("h-3.5 w-4/5 rounded-full", bone)} />
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <div className="text-caption font-semibold text-muted">{children}</div>;
}

/* ── Screen ──────────────────────────────────────────────────────────── */

export function TrainPicker() {
  useWizardGuard(["dep_code", "arr_code", "travel_date"]);
  const navigate = useNavigate();
  const haptic = useHaptic();
  const setField = useWizard(s => s.setField);
  const dep_code = useWizardField("dep_code");
  const arr_code = useWizardField("arr_code");
  const travel_date = useWizardField("travel_date");
  const train_numbers = useWizardField("train_numbers");

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["trains", dep_code, arr_code, travel_date],
    queryFn: () => searchTrains({
      dep_code: dep_code as string,
      arr_code: arr_code as string,
      date: travel_date as string,
    }),
    enabled: !!(dep_code && arr_code && travel_date),
  });

  // railway.uz returns trains whose tickets have not been released yet: both
  // its list and detail endpoints report nothing for them (detail answers 204).
  // eticket's own site leaves them out, which is why our list looked different.
  // They stay here — being notified the moment they go on sale is the point of
  // the app — but grouped last and clearly labelled, never silently mixed in.
  const { onSale, notOnSale } = useMemo(() => {
    const all = data ?? [];
    return {
      onSale: all.filter(t => t.car_types.length > 0),
      notOnSale: all.filter(t => t.car_types.length === 0),
    };
  }, [data]);

  const toggle = (n: string) => {
    haptic.selection();
    setField(
      "train_numbers",
      train_numbers.includes(n)
        ? train_numbers.filter(x => x !== n)
        : [...train_numbers, n],
    );
  };

  // Cards arrive one after another, a beat apart (capped, so a long list
  // does not keep the last one waiting).
  const cards = (trains: Train[], offset = 0) => (
    <div className="space-y-3">
      {trains.map((t, i) => (
        <m.div
          key={t.number}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.smooth, delay: Math.min(i + offset, 6) * 0.05 }}
        >
          <TrainCard
            t={t}
            selected={train_numbers.includes(t.number)}
            onToggle={() => toggle(t.number)}
          />
        </m.div>
      ))}
    </div>
  );

  return (
    <Screen
      padded
      wizard
      title="Poyezd tanlang"
      subtitle={
        train_numbers.length ? <><Ticker value={train_numbers.length} /> ta tanlandi</> :
        data ? `${onSale.length} ta poyezdda joy bor · bir nechtasini tanlash mumkin` :
        isLoading ? "Qidirilmoqda..." :
        undefined
      }
    >
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <TrainCardSkeleton key={i} />)}
        </div>
      )}

      {!!error && (
        <EmptyNote
          icon={CloudOff}
          title="railway.uz mavjud emas"
          body="Bir oz keyin qayta urinib ko'ring."
          action={
            <Button variant="secondary" size="sm" loading={isFetching} onClick={() => refetch()}>
              Qayta urinish
            </Button>
          }
        />
      )}

      {!isLoading && !error && data?.length === 0 && (
        <EmptyNote icon={TrainFront} title="Poyezdlar topilmadi" body="Boshqa sanani tanlang." />
      )}

      {onSale.length > 0 && (
        <div className="space-y-2">
          {notOnSale.length > 0 && (
            <div className="px-1">
              <GroupLabel>Sotuvda · {onSale.length} ta</GroupLabel>
            </div>
          )}
          {cards(onSale)}
        </div>
      )}

      {notOnSale.length > 0 && (
        <div className="space-y-2">
          <div className="space-y-1 px-1 pb-1">
            <GroupLabel>Hozircha sotuvda yo'q · {notOnSale.length} ta</GroupLabel>
            <p className="text-body-sm text-muted">
              Bu poyezdlarga chiptalar hali ochilmagan — shuning uchun
              eticket'da ko'rinmaydi. Tanlasangiz, sotuvga chiqishi bilan
              xabar beramiz.
            </p>
          </div>
          {cards(notOnSale, onSale.length)}
        </div>
      )}

      {!!data?.length && (
        <StickyAction hint={train_numbers.length === 0 ? "Kamida bitta poyezd tanlang" : undefined}>
          <Button
            full
            size="lg"
            disabled={train_numbers.length === 0}
            onClick={() => {
              haptic.impact("light");
              navigate("/new/car-type");
            }}
          >
            Davom etish
          </Button>
        </StickyAction>
      )}
    </Screen>
  );
}
