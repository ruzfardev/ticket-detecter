import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Cell, Checkbox, List, Section } from "@telegram-apps/telegram-ui";

import { useTelegram } from "@/hooks/useTelegram";
import { useWizard } from "@/store/wizard";

const CAR_TYPES = ["плацкарта", "купе", "люкс", "св", "сидячий"] as const;
const BERTH_TYPES = new Set(["плацкарта", "купе"]);

export function CarTypePicker() {
  const navigate = useNavigate();
  const { mainButton } = useTelegram();
  const { car_types, setField } = useWizard();

  useEffect(() => {
    if (!mainButton) return;
    mainButton.setText("Davom etish");
    mainButton.show();
    if (car_types.length > 0) mainButton.enable();
    else mainButton.disable();
    const handler = () => {
      const needsBerth = car_types.some(t => BERTH_TYPES.has(t));
      navigate(needsBerth ? "/new/berth" : "/new/confirm");
    };
    mainButton.onClick(handler);
    return () => mainButton.offClick(handler);
  }, [mainButton, car_types, navigate]);

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
        footer="Bir nechta tanlash mumkin. Bo'sh qoldirsangiz hammasi tekshiriladi (lekin kamida 1 ta tanlash kerak)."
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
