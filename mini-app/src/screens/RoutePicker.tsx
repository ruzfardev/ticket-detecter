import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Search, MapPin, ArrowLeftRight, Check } from "lucide-react";

import { listStations, Station } from "@/api/client";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { EmptyNote } from "@/components/EmptyNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTile } from "@/components/ui/tile";
import { useHaptic } from "@/hooks/useHaptic";

type Mode = "dep" | "arr";

/** One end of the route: a label, the chosen station, and the lens when it is
 *  the end currently being picked. */
function End({
  label, value, placeholder, active, onClick, lensId,
}: {
  label: string; value?: string; placeholder: string; active: boolean;
  onClick: () => void; lensId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="tap relative min-w-0 rounded-[22px] px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-bright"
    >
      {active && (
        <m.span
          layoutId={lensId}
          transition={spring.lens}
          className="lens-tint absolute inset-0 rounded-[22px]"
        />
      )}
      <span className="relative block">
        <span className="block text-caption font-semibold text-muted">{label}</span>
        <span
          className={cn(
            "mt-0.5 block truncate text-title-md",
            value ? "text-ink" : "text-muted-soft",
          )}
        >
          {value || placeholder}
        </span>
      </span>
    </button>
  );
}

export function RoutePicker() {
  // No fields required at step 1 — this is here so a finished wizard evicts
  // itself from /new too, not just from the later steps.
  useWizardGuard([]);
  const navigate = useNavigate();
  const haptic = useHaptic();
  const setField = useWizard(s => s.setField);
  const dep_code = useWizardField("dep_code");
  const dep_name = useWizardField("dep_name");
  const arr_code = useWizardField("arr_code");
  const arr_name = useWizardField("arr_name");

  const [mode, setMode] = useState<Mode>(dep_code ? "arr" : "dep");
  const [q, setQ] = useState("");
  const [swaps, setSwaps] = useState(0);

  const { data: stations, isLoading } = useQuery({
    queryKey: ["stations", q],
    queryFn: () => listStations(q),
    staleTime: 30_000,
  });

  const ready = !!(dep_code && arr_code && dep_code !== arr_code);

  const pick = (s: Station) => {
    haptic.selection();
    if (mode === "dep") {
      setField("dep_code", s.code);
      setField("dep_name", s.name);
      setMode("arr");
      setQ("");
    } else {
      setField("arr_code", s.code);
      setField("arr_name", s.name);
    }
  };

  // Swap the two ends in place. With only one end chosen the empty side moves
  // too, so the picker reopens on whichever end is now missing.
  const swap = () => {
    haptic.impact("light");
    setSwaps(n => n + 1);
    setField("dep_code", arr_code);
    setField("dep_name", arr_name);
    setField("arr_code", dep_code);
    setField("arr_name", dep_name);
    if (!arr_code) setMode("dep");
    else if (!dep_code) setMode("arr");
  };

  const hint = !dep_code
    ? "Avval qayerdan ekanini tanlang"
    : !arr_code
      ? "Endi qayerga ekanini tanlang"
      : dep_code === arr_code
        ? "Manzillar bir xil bo'lmasligi kerak"
        : undefined;

  const list = (stations ?? []).slice(0, 30);

  return (
    <Screen
      padded
      wizard
      title="Marshrut"
      subtitle={
        <span className="relative inline-block h-[22px] overflow-hidden align-bottom">
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={mode}
              className="inline-block"
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -18, opacity: 0 }}
              transition={spring.smooth}
            >
              {mode === "dep" ? "Qayerdan?" : "Qayerga?"}
            </m.span>
          </AnimatePresence>
        </span>
      }
    >
      {/* The route so far — tap an end to choose it, or swap the two. */}
      <div className="surface relative grid grid-cols-[1fr_auto_1fr] items-center p-1.5">
        <End
          label="Qayerdan"
          placeholder="Tanlang"
          value={dep_name}
          active={mode === "dep"}
          onClick={() => { haptic.selection(); setMode("dep"); }}
          lensId="route-lens"
        />
        <m.button
          type="button"
          onClick={swap}
          aria-label="Yo'nalishni almashtirish"
          whileTap={{ scale: 0.86 }}
          animate={{ rotate: swaps * 180 }}
          transition={spring.bouncy}
          className="glass tap relative z-10 mx-1 flex size-10 items-center justify-center rounded-full text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-bright"
        >
          <ArrowLeftRight className="size-[18px]" strokeWidth={2.2} />
        </m.button>
        <End
          label="Qayerga"
          placeholder="Tanlang"
          value={arr_name}
          active={mode === "arr"}
          onClick={() => { haptic.selection(); setMode("arr"); }}
          lensId="route-lens"
        />
      </div>

      <Input
        before={<Search className="size-[18px]" strokeWidth={2} />}
        placeholder="Stantsiya nomi..."
        value={q}
        onChange={e => setQ(e.target.value)}
        enterKeyHint="search"
        autoComplete="off"
        aria-label="Stantsiya qidirish"
      />

      {isLoading ? (
        <div className="space-y-px overflow-hidden rounded-[26px]">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-[60px] rounded-none" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyNote icon={Search} title="Stantsiya topilmadi" body="Boshqa nom bilan qidirib ko'ring." />
      ) : (
        <ListGroup>
          {list.map(s => {
            const selected =
              (mode === "dep" && dep_code === s.code) ||
              (mode === "arr" && arr_code === s.code);
            return (
              <ListRow
                key={s.code}
                before={<IconTile icon={MapPin} tone={selected ? "coral" : "gray"} soft={!selected} />}
                title={s.name}
                subtitle={s.city ?? undefined}
                selected={selected}
                after={selected ? <Check className="pop-in size-5 text-coral-ink" strokeWidth={2.8} /> : undefined}
                onClick={() => pick(s)}
              />
            );
          })}
        </ListGroup>
      )}

      <StickyAction hint={!ready ? hint : undefined}>
        <Button
          full
          size="lg"
          disabled={!ready}
          onClick={() => {
            haptic.impact("light");
            navigate("/new/date");
          }}
        >
          Davom etish
        </Button>
      </StickyAction>
    </Screen>
  );
}
