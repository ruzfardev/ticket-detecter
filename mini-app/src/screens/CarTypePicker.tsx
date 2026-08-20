import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { searchTrains } from "@/api/client";
import { useHaptic } from "@/hooks/useHaptic";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { carTypeLabel } from "@/lib/cartypes";

/** Mirrors backend VALID_CAR_TYPES — the fallback when we have no train data. */
const ALL_CAR_TYPES = [
  "плацкарта", "купе", "люкс", "св", "сидячий", "общий", "эконом", "бизнес",
] as const;

/** Mirrors backend BERTH_TYPES: only these have lower/upper semantics. */
const BERTH_TYPES = new Set(["плацкарта", "купе"]);

type Option = { type: string; label: string; seats: number };

export function CarTypePicker() {
  useWizardGuard(["dep_code", "arr_code", "travel_date", "train_numbers"]);
  const navigate = useNavigate();
  const haptic = useHaptic();
  const setField = useWizard(s => s.setField);
  const car_types = useWizardField("car_types");
  const dep_code = useWizardField("dep_code");
  const arr_code = useWizardField("arr_code");
  const travel_date = useWizardField("travel_date");
  const train_numbers = useWizardField("train_numbers");

  // Same key as TrainPicker, so this normally reads straight from cache.
  const { data: trains, isLoading } = useQuery({
    queryKey: ["trains", dep_code, arr_code, travel_date],
    queryFn: () => searchTrains({
      dep_code: dep_code as string,
      arr_code: arr_code as string,
      date: travel_date as string,
    }),
    enabled: !!(dep_code && arr_code && travel_date),
  });

  // Offer what the CHOSEN trains actually carry. A hard-coded list both hid
  // real types (080Ф sells 81 "Umumiy" seats, which was not even listed) and
  // offered types the train has none of — and a subscription on one of those
  // can never fire.
  const options = useMemo<Option[]>(() => {
    const picked = (trains ?? []).filter(
      t => train_numbers.length === 0 || train_numbers.includes(t.number),
    );
    const byType = new Map<string, Option>();
    for (const t of picked) {
      for (const c of t.car_types) {
        const prev = byType.get(c.type);
        byType.set(c.type, {
          type: c.type,
          label: c.label ?? c.type,
          seats: (prev?.seats ?? 0) + c.free_seats,
        });
      }
    }
    return [...byType.values()].sort((a, b) => b.seats - a.seats);
  }, [trains, train_numbers]);

  // No train data (offline, or trains not on sale yet) — fall back to the full
  // canonical list rather than blocking the wizard.
  const fallback = !isLoading && options.length === 0;
  const shown: Option[] = fallback
    ? ALL_CAR_TYPES.map(t => ({ type: t, label: carTypeLabel(t), seats: 0 }))
    : options;

  // Drop selections that the chosen trains do not offer, so a stale pick from
  // an earlier train choice cannot silently survive into the subscription.
  const valid = new Set(shown.map(o => o.type));
  const selected = car_types.filter(t => valid.has(t));

  const toggle = (t: string) => {
    haptic.selection();
    setField(
      "car_types",
      selected.includes(t) ? selected.filter(x => x !== t) : [...selected, t],
    );
  };

  const handleContinue = () => {
    haptic.impact("light");
    if (selected.length !== car_types.length) setField("car_types", selected);
    const needsBerth = selected.some(t => BERTH_TYPES.has(t));
    navigate(needsBerth ? "/new/berth" : "/new/confirm");
  };

  return (
    <Screen
      padded
      wizard
      title="Vagon turi"
      subtitle={
        isLoading ? "Yuklanmoqda…"
          : fallback ? "Barcha turlar"
          : train_numbers.length
            ? `Tanlangan ${train_numbers.length} ta poyezdda mavjud`
            : "Ushbu yo'nalishda mavjud"
      }
    >
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
        </div>
      )}

      {fallback && (
        <div className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-card p-3 text-body-sm text-muted">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
          <span>
            Poyezd ma'lumotini olib bo'lmadi — barcha turlar ko'rsatilmoqda.
            Tanlagan turingiz bu poyezdda bo'lmasligi mumkin.
          </span>
        </div>
      )}

      {!isLoading && (
        <ListGroup footer="Faqat plaskart va kupe past/tepa o'rinni qo'llab-quvvatlaydi.">
          {shown.map(o => {
            const checked = selected.includes(o.type);
            return (
              <ListRow
                key={o.type}
                before={<Checkbox checked={checked} tabIndex={-1} />}
                title={o.label}
                subtitle={o.seats > 0 ? `${o.seats} ta joy` : undefined}
                selected={checked}
                onClick={() => toggle(o.type)}
              />
            );
          })}
        </ListGroup>
      )}

      <StickyAction hint={selected.length === 0 ? "Kamida 1 ta vagon turini tanlang" : undefined}>
        <Button full disabled={selected.length === 0} onClick={handleContinue}>
          Davom etish
        </Button>
      </StickyAction>
    </Screen>
  );
}
