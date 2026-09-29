import { useNavigate } from "react-router-dom";
import { ArrowDownToLine, ArrowUpDown, ArrowUpToLine, type LucideIcon } from "lucide-react";

import { useHaptic } from "@/hooks/useHaptic";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard, Berth } from "@/store/wizard";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ListGroup, ListRow } from "@/components/ui/list";
import { IconTile } from "@/components/ui/tile";

type Option = {
  value: Berth;
  title: string;
  sub: string;
  Icon: LucideIcon;
};

const OPTIONS: Option[] = [
  { value: "lower", title: "Pastki o'rin", sub: "Toq raqamlar · chiqish oson",   Icon: ArrowDownToLine },
  { value: "upper", title: "Tepa o'rin",   sub: "Juft raqamlar · tinchroq",      Icon: ArrowUpToLine },
  { value: "any",   title: "Farqi yo'q",   sub: "Har qanday joy",                Icon: ArrowUpDown },
];

export function BerthPicker() {
  useWizardGuard(["dep_code", "arr_code", "travel_date", "train_numbers", "car_types"]);
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
      {/* The radios are the real controls (Tab lands on the chosen one, arrows
          move between them); each row around one is a big tap target for it. */}
      <RadioGroup
        value={berth}
        onValueChange={v => pickBerth(v as Berth)}
        aria-label="Joy turi"
        className="block"
      >
        <ListGroup>
          {OPTIONS.map(({ value, title, sub, Icon }) => {
            const on = berth === value;
            return (
              <ListRow
                key={value}
                // Not a second control: the radio inside is the one.
                role={undefined}
                tabIndex={undefined}
                className="min-h-[76px] py-3"
                // hairline starts under the text: 16 padding + 44 tile + 14 gap
                inset={74}
                before={<IconTile icon={Icon} tone={on ? "coral" : "gray"} soft={!on} size={44} />}
                title={title}
                subtitle={sub}
                after={
                  <RadioGroupItem
                    value={value}
                    aria-label={title}
                    // Radix selects on its own click; don't let the row repeat it.
                    onClick={e => e.stopPropagation()}
                  />
                }
                selected={on}
                onClick={() => pickBerth(value)}
              />
            );
          })}
        </ListGroup>
      </RadioGroup>

      <StickyAction>
        <Button
          full
          size="lg"
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
