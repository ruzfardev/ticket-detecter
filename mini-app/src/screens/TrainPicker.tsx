import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Inbox } from "lucide-react";

import { searchTrains } from "@/api/client";
import { useHaptic } from "@/hooks/useHaptic";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function fmtTime(iso: string): string {
  if (iso.includes("T") && iso.length >= 16) return iso.slice(11, 16);
  return iso;
}

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

  return (
    <Screen
      padded
      wizard
      title="Poyezd tanlang"
      subtitle={
        train_numbers.length ? `${train_numbers.length} ta tanlandi` :
        data ? `${data.length} ta poyezd · bir nechtasini tanlash mumkin` :
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

      <div className="space-y-2">
        {data?.map(t => {
          const total = t.car_types.reduce((s, c) => s + c.free_seats, 0);
          const selected = train_numbers.includes(t.number);
          return (
            <button
              key={t.number}
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
                "w-full text-left rounded-lg p-4 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30",
                selected
                  ? "bg-surface-cream-strong border-2 border-coral"
                  : "bg-surface-card border-2 border-transparent hover:bg-surface-cream-strong",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-display-sm text-ink">{t.number}</span>
                    {t.brand && (
                      <span className="text-body-sm text-muted truncate">{t.brand}</span>
                    )}
                  </div>
                  <div className="text-body-sm text-body tabular-nums">
                    {fmtTime(t.departure)} → {fmtTime(t.arrival)}
                    {t.time_on_way && <span className="text-muted"> · {t.time_on_way}</span>}
                  </div>
                  <div className="text-body-sm text-muted">
                    {t.car_types.length > 0
                      ? t.car_types.map(c => `${c.type} (${c.free_seats})`).join(", ")
                      : "joy yo'q"}
                  </div>
                </div>
                <Badge variant={total > 0 ? "coral" : "muted"}>
                  {total}
                </Badge>
              </div>
            </button>
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
