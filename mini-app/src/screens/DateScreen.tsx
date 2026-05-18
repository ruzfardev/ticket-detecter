import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, formatISO } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { List, Section } from "@telegram-apps/telegram-ui";

import { useTelegram } from "@/hooks/useTelegram";
import { useWizard } from "@/store/wizard";

export function DateScreen() {
  const navigate = useNavigate();
  const { mainButton } = useTelegram();
  const { travel_date, setField } = useWizard();
  const today = new Date();
  const maxDate = addDays(today, 60);

  useEffect(() => {
    if (!mainButton) return;
    mainButton.setText("Davom etish");
    mainButton.show();
    if (travel_date) mainButton.enable();
    else mainButton.disable();
    const handler = () => navigate("/new/train");
    mainButton.onClick(handler);
    return () => mainButton.offClick(handler);
  }, [mainButton, travel_date, navigate]);

  return (
    <List>
      <Section header="Qachon sayohat qilasiz?" footer={travel_date}>
        <div style={{ display: "grid", placeItems: "center", padding: 8 }}>
          <DayPicker
            mode="single"
            selected={travel_date ? new Date(travel_date) : undefined}
            onSelect={d => d && setField("travel_date", formatISO(d, { representation: "date" }))}
            disabled={{ before: today, after: maxDate }}
            weekStartsOn={1}
          />
        </div>
      </Section>
    </List>
  );
}
