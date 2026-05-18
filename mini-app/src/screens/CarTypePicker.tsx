import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Cell, Checkbox, List, Section } from "@telegram-apps/telegram-ui";

import { useMainButton } from "@/hooks/useMainButton";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";

const CAR_TYPES = ["плацкарта", "купе", "люкс", "св", "сидячий"] as const;
const BERTH_TYPES = new Set(["плацкарта", "купе"]);

export function CarTypePicker() {
  useWizardGuard(["dep_code", "arr_code", "travel_date", "train_number"]);

  const navigate = useNavigate();
  const setField = useWizard(s => s.setField);
  const car_types = useWizardField("car_types");

  const onContinue = useCallback(() => {
    const needsBerth = car_types.some(t => BERTH_TYPES.has(t));
    navigate(needsBerth ? "/new/berth" : "/new/confirm");
  }, [car_types, navigate]);

  useMainButton({
    text: "Davom etish",
    enabled: car_types.length > 0,
    onClick: onContinue,
  });

  const toggle = (t: string) => {
    setField(
      "car_types",
      car_types.includes(t) ? car_types.filter(x => x !== t) : [...car_types, t],
    );
  };

  return (
    <List>
      <Section
        header="Vagon turi"
        footer="Bir nechta tanlash mumkin. Faqat plackart va kupe past/tepa o'rinni qo'llab-quvvatlaydi."
      >
        {CAR_TYPES.map(t => (
          <Cell
            key={t}
            before={<Checkbox checked={car_types.includes(t)} readOnly />}
            onClick={() => toggle(t)}
          >
            {t}
          </Cell>
        ))}
      </Section>
    </List>
  );
}
