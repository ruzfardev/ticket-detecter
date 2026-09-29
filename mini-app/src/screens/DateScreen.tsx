import { useNavigate } from "react-router-dom";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { addDays, format, formatISO, parseISO } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
// The theme must come after the library's defaults. index.css loads it before
// this file pulls in style.css, whose rules have the same specificity — so
// without this the accent turns blue and the day sizes/weekday type revert.
import "@/styles/calendar.css";

import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizard } from "@/store/wizard";
import { useHaptic } from "@/hooks/useHaptic";
import { formatMonth } from "@/lib/dates";
import { spring } from "@/lib/motion";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";

/** Sunday-first, as Date#getDay counts. */
const WEEKDAYS_UZ = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const WEEKDAYS_UZ_FULL = [
  "Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba",
];

/**
 * "2026-10-08" → "Payshanba, 8-oktabr, 2026" — CLDR's Uzbek long date, spelled
 * out here rather than left to toLocaleDateString: the device locale may be
 * anything (or lack Uzbek data and print "2026 M10 8, Thu"), and the rest of
 * the screen, the calendar included, is Uzbek.
 */
function fmtHuman(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const p = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!p) return iso;
  const [, y, mo, d] = p;
  const weekday = WEEKDAYS_UZ_FULL[new Date(+y, +mo - 1, +d).getDay()];
  const month = formatMonth(`${y}-${mo}`).split(" ")[0].toLowerCase();
  return `${weekday}, ${+d}-${month}, ${y}`;
}

/** The line under the title rolls to the new date each time a day is tapped. */
function RollingLine({ text }: { text: string }) {
  return (
    <span className="relative inline-block h-[22px] max-w-full overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={text}
          className="inline-block whitespace-nowrap"
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -18, opacity: 0 }}
          transition={spring.smooth}
        >
          {text}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

export function DateScreen() {
  useWizardGuard(["dep_code", "arr_code"]);
  const navigate = useNavigate();
  const haptic = useHaptic();
  const setField = useWizard(s => s.setField);
  const travel_date = useWizardField("travel_date");

  const today = new Date();
  const maxDate = addDays(today, 60);
  // Local midnight: `new Date("2026-10-08")` is UTC midnight, which is the
  // day before anywhere west of Greenwich.
  const selected = travel_date ? parseISO(travel_date) : undefined;

  return (
    <Screen
      padded
      wizard
      title="Qachon?"
      subtitle={
        <RollingLine
          text={(travel_date && fmtHuman(travel_date)) || "Bugundan boshlab 60 kun ichida"}
        />
      }
    >
      <div className="surface px-2 pb-1.5 pt-2.5">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={d => {
            if (!d) return;
            haptic.selection();
            setField("travel_date", formatISO(d, { representation: "date" }));
          }}
          disabled={{ before: today, after: maxDate }}
          weekStartsOn={1}
          // Open on the chosen day's month, and never page into months where
          // every day is out of range.
          defaultMonth={selected}
          startMonth={today}
          endMonth={maxDate}
          formatters={{
            formatCaption: d => formatMonth(format(d, "yyyy-MM")),
            formatWeekdayName: d => WEEKDAYS_UZ[d.getDay()],
          }}
          labels={{
            labelPrevious: () => "Oldingi oy",
            labelNext: () => "Keyingi oy",
          }}
        />
      </div>

      <StickyAction hint={!travel_date ? "Sanani tanlang" : undefined}>
        <Button
          full
          size="lg"
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
