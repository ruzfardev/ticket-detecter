import { useNavigate } from "react-router-dom";
import { ArrowDownToLine, ArrowUpToLine, Minus } from "lucide-react";

import { useHaptic } from "@/hooks/useHaptic";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard, Berth } from "@/store/wizard";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ListGroup, ListRow } from "@/components/ui/list";

type Option = {
  value: Berth;
  title: string;
  sub: string;
  Icon: typeof ArrowDownToLine;
};

const OPTIONS: Option[] = [
  { value: "lower", title: "Pastki o'rin", sub: "Toq raqamlar · chiqish oson",   Icon: ArrowDownToLine },
  { value: "upper", title: "Tepa o'rin",   sub: "Juft raqamlar · tinchroq",      Icon: ArrowUpToLine },
  { value: "any",   title: "Farqi yo'q",   sub: "Har qanday joy",                Icon: Minus },
];

export function BerthPicker() {
  useWizardGuard(["dep_code", "arr_code", "travel_date", "train_number", "car_types"]);
  const navigate = useNavigate();
  const haptic = useHaptic();
  const setField = useWizard(s => s.setField);
  const berth = useWizardField("berth");

  const pickBerth = (v: Berth) => {
    haptic.selection();
    setField("berth", v);
  };

  return (
    <Screen
      padded
      wizard
      title="Joy turi"
      subtitle="Faqat plackart va kupe uchun"
    >
      <RadioGroup
        value={berth}
        onValueChange={v => pickBerth(v as Berth)}
        className="contents"
      >
        <ListGroup>
          {OPTIONS.map(({ value, title, sub, Icon }) => (
            <ListRow
              key={value}
              before={
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={value} tabIndex={-1} />
                  <Icon className="h-5 w-5 text-ink" strokeWidth={1.75} />
                </div>
              }
              title={title}
              subtitle={sub}
              selected={berth === value}
              onClick={() => pickBerth(value)}
            />
          ))}
        </ListGroup>
      </RadioGroup>

      <StickyAction>
        <Button
          full
          onClick={() => {
            haptic.impact("light");
            navigate("/new/confirm");
          }}
        >
          Davom etish
        </Button>
      </StickyAction>
    </Screen>
  );
}
