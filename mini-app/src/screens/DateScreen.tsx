import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, formatISO } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { List, Section } from "@telegram-apps/telegram-ui";

import { useMainButton } from "@/hooks/useMainButton";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { useWizardField } from "@/hooks/useWizardField";

function fmtHuman(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function DateScreen() {
  useWizardGuard(["dep_code", "arr_code"]);

  const navigate = useNavigate();
  const setField = useWizard(s => s.setField);
  const travel_date = useWizardField("travel_date");

  const today = new Date();
  const maxDate = addDays(today, 60);

  const onContinue = useCallback(() => navigate("/new/train"), [navigate]);
  useMainButton({ text: "Davom etish", enabled: !!travel_date, onClick: onContinue });

  return (
    <List>
      <Section
        header={travel_date ? fmtHuman(travel_date) : "Qachon sayohat qilasiz?"}
        footer="Bugundan boshlab keyingi 60 kun ichida"
      >
        <DayPicker
          mode="single"
          selected={travel_date ? new Date(travel_date) : undefined}
          onSelect={d => d && setField("travel_date", formatISO(d, { representation: "date" }))}
          disabled={{ before: today, after: maxDate }}
          weekStartsOn={1}
        />
      </Section>
    </List>
  );
}
