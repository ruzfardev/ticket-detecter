import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, ArrowRight } from "lucide-react";

import { listStations, Station } from "@/api/client";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizard } from "@/store/wizard";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { useHaptic } from "@/hooks/useHaptic";

type Mode = "dep" | "arr";

export function RoutePicker() {
  const navigate = useNavigate();
  const haptic = useHaptic();
  const setField = useWizard(s => s.setField);
  const dep_code = useWizardField("dep_code");
  const dep_name = useWizardField("dep_name");
  const arr_code = useWizardField("arr_code");
  const arr_name = useWizardField("arr_name");

  const [mode, setMode] = useState<Mode>(dep_code ? "arr" : "dep");
  const [q, setQ] = useState("");

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

  const hint = !dep_code
    ? "Avval qayerdan ekanini tanlang"
    : !arr_code
      ? "Endi qayerga ekanini tanlang"
      : dep_code === arr_code
        ? "Manzillar bir xil bo'lmasligi kerak"
        : undefined;

  return (
    <Screen padded wizard title="Marshrut" subtitle={mode === "dep" ? "Qayerdan?" : "Qayerga?"}>
      {/* Selected route preview */}
      {(dep_name || arr_name) && (
        <Card variant="feature" pad="md">
          <div className="flex items-center gap-2 text-body-md">
            <button
              type="button"
              onClick={() => setMode("dep")}
              className={`flex-1 text-left ${mode === "dep" ? "text-ink font-medium" : "text-muted"}`}
            >
              {dep_name || "Qayerdan?"}
            </button>
            <ArrowRight className="h-4 w-4 text-muted-soft" strokeWidth={1.75} />
            <button
              type="button"
              onClick={() => setMode("arr")}
              className={`flex-1 text-left ${mode === "arr" ? "text-ink font-medium" : "text-muted"}`}
            >
              {arr_name || "Qayerga?"}
            </button>
          </div>
        </Card>
      )}

      <Input
        before={<Search className="h-4 w-4" strokeWidth={1.75} />}
        placeholder="Stantsiya nomi..."
        value={q}
        onChange={e => setQ(e.target.value)}
        autoFocus
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <ListGroup>
          {(stations ?? []).slice(0, 30).map(s => {
            const selected =
              (mode === "dep" && dep_code === s.code) ||
              (mode === "arr" && arr_code === s.code);
            return (
              <ListRow
                key={s.code}
                before={
                  <div className="h-8 w-8 rounded-pill bg-canvas flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-ink" strokeWidth={1.75} />
                  </div>
                }
                title={s.name}
                subtitle={s.city ?? undefined}
                selected={selected}
                onClick={() => pick(s)}
              />
            );
          })}
        </ListGroup>
      )}

      <StickyAction hint={!ready ? hint : undefined}>
        <Button
          full
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
