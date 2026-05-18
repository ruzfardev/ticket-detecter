import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Cell, List, Radio, Section } from "@telegram-apps/telegram-ui";

import { useTelegram } from "@/hooks/useTelegram";
import { useWizard, Berth } from "@/store/wizard";

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

  const opts: { value: Berth; title: string; sub: string }[] = [
    { value: "lower", title: "⬇️ Pastki o'rin",  sub: "Toq raqamlar · chiqish oson" },
    { value: "upper", title: "⬆️ Tepa o'rin",    sub: "Juft raqamlar · tinchroq" },
    { value: "any",   title: "🟦 Farqi yo'q",    sub: "Har qanday joy" },
  ];

  return (
    <List>
      <Section header="Joy turi" footer="Faqat плацкарта va купе uchun ahamiyatli.">
        {opts.map(o => (
          <Cell
            key={o.value}
            before={
              <Radio name="berth" value={o.value}
                     checked={berth === o.value}
                     onChange={() => setField("berth", o.value)} />
            }
            subtitle={o.sub}
            onClick={() => setField("berth", o.value)}
          >
            {o.title}
          </Cell>
        ))}
      </Section>
    </List>
  );
}
