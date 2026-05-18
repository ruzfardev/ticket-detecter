import { useNavigate } from "react-router-dom";
import { addDays, formatISO } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizard } from "@/store/wizard";
import { useHaptic } from "@/hooks/useHaptic";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function fmtHuman(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function DateScreen() {
  useWizardGuard(["dep_code", "arr_code"]);
  const navigate = useNavigate();
  const haptic = useHaptic();
  const setField = useWizard(s => s.setField);
  const travel_date = useWizardField("travel_date");

  const today = new Date();
  const maxDate = addDays(today, 60);

  return (
    <Screen
      padded
      wizard
      title="Qachon?"
      subtitle={travel_date ? fmtHuman(travel_date) : "Bugundan boshlab 60 kun ichida"}
    >
      <Card variant="feature" pad="sm">
        <DayPicker
          mode="single"
          selected={travel_date ? new Date(travel_date) : undefined}
          onSelect={d => {
            if (!d) return;
            haptic.selection();
            setField("travel_date", formatISO(d, { representation: "date" }));
          }}
          disabled={{ before: today, after: maxDate }}
          weekStartsOn={1}
        />
      </Card>

      <StickyAction hint={!travel_date ? "Sanani tanlang" : undefined}>
        <Button
          full
          disabled={!travel_date}
          onClick={() => {
            haptic.impact("light");
            navigate("/new/train");
          }}
        >
          Davom etish
        </Button>
      </StickyAction>
    </Screen>
  );
}
