import { useNavigate } from "react-router-dom";
import { addDays, format, formatISO, parseISO } from "date-fns";
import { uz } from "date-fns/locale";
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

/** "Chorshanba, 18-noyabr". Uzbek writes the month in lower case after the
 *  day; date-fns capitalises it, so it is lowered here. */
function fmtHuman(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  try {
    const d = parseISO(iso);
    const month = format(d, "MMMM", { locale: uz }).toLowerCase();
    return `${format(d, "EEEE", { locale: uz })}, ${format(d, "d")}-${month}`;
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
          className="td-cal"
          locale={uz}
          mode="single"
          startMonth={today}
          endMonth={maxDate}
          selected={travel_date ? parseISO(travel_date) : undefined}
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
