import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Cell, List, Radio, Section } from "@telegram-apps/telegram-ui";
import { ArrowDownToLine, ArrowUpToLine, Minus } from "lucide-react";

import { useMainButton } from "@/hooks/useMainButton";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard, Berth } from "@/store/wizard";
import { IconText } from "@/ui";

type Option = {
  value: Berth;
  title: string;
  sub: string;
  Icon: typeof ArrowDownToLine;
};

const OPTIONS: Option[] = [
  { value: "lower", title: "Pastki o'rin", sub: "Toq raqamlar · chiqish oson", Icon: ArrowDownToLine },
  { value: "upper", title: "Tepa o'rin",   sub: "Juft raqamlar · tinchroq",    Icon: ArrowUpToLine },
  { value: "any",   title: "Farqi yo'q",   sub: "Har qanday joy",              Icon: Minus },
];

export function BerthPicker() {
  useWizardGuard(["dep_code", "arr_code", "travel_date", "train_number", "car_types"]);

  const navigate = useNavigate();
  const setField = useWizard(s => s.setField);
  const berth = useWizardField("berth");

  const onContinue = useCallback(() => navigate("/new/confirm"), [navigate]);
  useMainButton({ text: "Davom etish", enabled: true, onClick: onContinue });

  return (
    <List>
      <Section header="Joy turi" footer="Faqat plackart va kupe uchun.">
        {OPTIONS.map(({ value, title, sub, Icon }) => (
          <Cell
            key={value}
            before={<Radio name="berth" value={value} checked={berth === value} readOnly />}
            subtitle={sub}
            onClick={() => setField("berth", value)}
          >
            <IconText icon={Icon}>{title}</IconText>
          </Cell>
        ))}
      </Section>
    </List>
  );
}
