import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Cell, List, Radio, Section } from "@telegram-apps/telegram-ui";
import { ArrowDownToLine, ArrowUpToLine, Minus } from "lucide-react";

import { useTelegram } from "@/hooks/useTelegram";
import { useWizard, Berth } from "@/store/wizard";

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
  const navigate = useNavigate();
  const { mainButton } = useTelegram();
  const { berth, setField } = useWizard();

  useEffect(() => {
    if (!mainButton) return;
    mainButton.setText("Davom etish");
    mainButton.show();
    mainButton.enable();
    const handler = () => navigate("/new/confirm");
    mainButton.onClick(handler);
    return () => mainButton.offClick(handler);
  }, [mainButton, navigate]);

  return (
    <List>
      <Section header="Joy turi" footer="Faqat плацкарта va купе uchun ahamiyatli.">
        {OPTIONS.map(({ value, title, sub, Icon }) => (
          <Cell
            key={value}
            before={
              <Radio name="berth" value={value}
                     checked={berth === value}
                     onChange={() => setField("berth", value)} />
            }
            subtitle={sub}
            onClick={() => setField("berth", value)}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon size={18} strokeWidth={1.75} />
              {title}
            </span>
          </Cell>
        ))}
      </Section>
    </List>
  );
}
