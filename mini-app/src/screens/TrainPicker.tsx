import { Fragment, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Inbox } from "lucide-react";

import { searchTrains } from "@/api/client";
import { useHaptic } from "@/hooks/useHaptic";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { insightText } from "@/lib/insight";
import { dayOffset, trainTime } from "@/lib/traintime";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";


export function TrainPicker() {
  useWizardGuard(["dep_code", "arr_code", "travel_date"]);
  const navigate = useNavigate();
  const haptic = useHaptic();
  const setField = useWizard(s => s.setField);
  const dep_code = useWizardField("dep_code");
  const arr_code = useWizardField("arr_code");
  const travel_date = useWizardField("travel_date");
  const train_numbers = useWizardField("train_numbers");

  const { data, isLoading, error } = useQuery({
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
  const { onSale, notOnSale, ordered } = useMemo(() => {
    const all = data ?? [];
    const a = all.filter(t => t.car_types.length > 0);
    const b = all.filter(t => t.car_types.length === 0);
    return { onSale: a, notOnSale: b, ordered: [...a, ...b] };
  }, [data]);

  return (
    <Screen
      padded
      wizard
      title="Poyezd tanlang"
      subtitle={
        train_numbers.length ? `${train_numbers.length} ta tanlandi` :
        data ? `${onSale.length} ta poyezdda joy bor · bir nechtasini tanlash mumkin` :
        isLoading ? "Qidirilmoqda..." :
        undefined
      }
    >
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      )}

      {!!error && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-error" strokeWidth={1.5} />
          <div>
            <h3 className="font-display text-display-sm text-ink">railway.uz mavjud emas</h3>
            <p className="text-body-md text-muted mt-1">Bir oz keyin qayta urinib ko'ring.</p>
          </div>
        </div>
      )}

      {!isLoading && !error && data?.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Inbox className="h-8 w-8 text-muted-soft" strokeWidth={1.5} />
          <div>
            <h3 className="font-display text-display-sm text-ink">Poyezdlar topilmadi</h3>
            <p className="text-body-md text-muted mt-1">Boshqa sanani tanlang.</p>
          </div>
        </div>
      )}

      {onSale.length > 0 && notOnSale.length > 0 && (
        <p className="px-1 text-caption-upper uppercase text-muted">
          Sotuvda · {onSale.length} ta
        </p>
      )}

      <div className="space-y-2">
        {ordered.map((t, i) => {
          const total = t.car_types.reduce((s, c) => s + c.free_seats, 0);
          const selected = train_numbers.includes(t.number);
          const firstUnavailable =
            total === 0 && i > 0 && ordered[i - 1].car_types.length > 0;
          return (
            <Fragment key={t.number}>
            {firstUnavailable && (
              <div className="px-1 pt-4">
                <p className="text-caption-upper uppercase text-muted">
                  Hozircha sotuvda yo'q · {notOnSale.length} ta
                </p>
                <p className="mt-1 text-body-sm text-muted">
                  Bu poyezdlarga chiptalar hali ochilmagan — shuning uchun
                  eticket'da ko'rinmaydi. Tanlasangiz, sotuvga chiqishi bilan
                  xabar beramiz.
                </p>
              </div>
            )}
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => {
                haptic.selection();
                setField(
                  "train_numbers",
                  selected
                    ? train_numbers.filter(n => n !== t.number)
                    : [...train_numbers, t.number],
                );
              }}
              className={cn(
                "w-full overflow-hidden rounded-2xl text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30",
                selected
                  ? "bg-surface-cream-strong border-2 border-coral"
                  : "bg-surface-card border-2 border-hairline-soft hover:bg-surface-cream-strong",
                total === 0 && !selected && "opacity-80",
              )}
            >
              <div className="space-y-3 p-4">
                {/* brand + number + selection state */}
                <div className="flex items-center gap-2">
                  {t.brand && (
                    <span className="rounded-md bg-surface-cream-strong px-2 py-0.5 text-caption font-medium text-body-strong">
                      {t.brand}
                    </span>
                  )}
                  <span className="font-display text-display-sm text-ink">{t.number}</span>
                  <span className="ml-auto shrink-0">
                    {selected ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral text-on-primary">
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="block h-6 w-6 rounded-full border-2 border-hairline" />
                    )}
                  </span>
                </div>

                {/* stations + times, with the journey time on the connector */}
                <div className="flex items-end gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-caption-upper uppercase text-muted">
                      {t.dep_station || "—"}
                    </div>
                    <div className="font-display text-display-sm tabular-nums text-coral">
                      {trainTime(t.departure)}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col items-center pb-1">
                    {t.time_on_way && (
                      <span className="rounded-pill border border-hairline px-2 py-0.5 text-caption tabular-nums text-muted">
                        {t.time_on_way}
                      </span>
                    )}
                    <div className="mt-1 w-full border-t border-dashed border-hairline" />
                  </div>

                  <div className="min-w-0 text-right">
                    <div className="truncate text-caption-upper uppercase text-muted">
                      {t.arr_station || "—"}
                    </div>
                    <div className="font-display text-display-sm tabular-nums text-coral">
                      {trainTime(t.arrival)}
                      {dayOffset(t.departure, t.arrival) > 0 && (
                        <sup className="ml-0.5 text-caption text-muted">
                          +{dayOffset(t.departure, t.arrival)}
                        </sup>
                      )}
                    </div>
                  </div>
                </div>

                {/* car types with seat counts and starting price */}
                {t.car_types.length > 0 ? (
                  <div className="space-y-1 border-t border-hairline-soft pt-3">
                    {t.car_types.map(c => {
                      const hint = insightText(c.insight);
                      return (
                        <div key={c.type}>
                          <div className="flex items-baseline justify-between gap-2 text-body-sm">
                        <span className="truncate text-body">{c.label ?? c.type}</span>
                        <span className="shrink-0 tabular-nums text-muted">
                          <b className="font-medium text-ink">{c.free_seats}</b> ta joy
                          {c.price_uzs ? (
                            <>
                              {" · "}
                              <b className="font-medium text-ink">
                                {c.price_uzs.toLocaleString("ru-RU").replace(/ /g, " ")}
                              </b>{" "}
                              so'm dan
                            </>
                          ) : null}
                        </span>
                          </div>
                          {/* what the watcher has seen — the one thing nobody else shows */}
                          {hint && (
                            <div className="text-caption text-muted">{hint}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border-t border-hairline-soft pt-3 text-body-sm text-muted">
                    Chiptalar hali ochilmagan
                  </div>
                )}
              </div>
            </button>
            </Fragment>
          );
        })}
      </div>

      {!!data?.length && (
        <StickyAction hint={train_numbers.length === 0 ? "Kamida bitta poyezd tanlang" : undefined}>
          <Button
            full
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
