import { useNavigate } from "react-router-dom";

import { useHaptic } from "@/hooks/useHaptic";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ListGroup, ListRow } from "@/components/ui/list";

const CAR_TYPES = ["плацкарта", "купе", "люкс", "св", "сидячий"] as const;
const BERTH_TYPES = new Set(["плацкарта", "купе"]);

export function CarTypePicker() {
  useWizardGuard(["dep_code", "arr_code", "travel_date", "train_number"]);
  const navigate = useNavigate();
  const haptic = useHaptic();
  const setField = useWizard(s => s.setField);
  const car_types = useWizardField("car_types");

  const toggle = (t: string) => {
    haptic.selection();
    setField(
      "car_types",
      car_types.includes(t) ? car_types.filter(x => x !== t) : [...car_types, t],
    );
  };

  const handleContinue = () => {
    haptic.impact("light");
    const needsBerth = car_types.some(t => BERTH_TYPES.has(t));
    navigate(needsBerth ? "/new/berth" : "/new/confirm");
  };

  return (
    <Screen
      padded
      wizard
      title="Vagon turi"
      subtitle="Bir nechta tanlash mumkin"
    >
      <ListGroup
        footer="Faqat plackart va kupe past/tepa o'rinni qo'llab-quvvatlaydi."
      >
        {CAR_TYPES.map(t => {
          const checked = car_types.includes(t);
          return (
            <ListRow
              key={t}
              before={<Checkbox checked={checked} tabIndex={-1} />}
              title={t}
              selected={checked}
              onClick={() => toggle(t)}
            />
          );
        })}
      </ListGroup>

      <StickyAction hint={car_types.length === 0 ? "Kamida 1 ta vagon turini tanlang" : undefined}>
        <Button full disabled={car_types.length === 0} onClick={handleContinue}>
          Davom etish
        </Button>
      </StickyAction>
    </Screen>
  );
}
