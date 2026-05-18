import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Caption, Cell, Input, List, Section } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";

import { getInvoice, getPlans } from "@/api/client";
import { useMainButton } from "@/hooks/useMainButton";
import { useTelegram } from "@/hooks/useTelegram";
import { Money, StatusView } from "@/ui";

export function DonateCustom() {
  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const { openInvoice, haptic } = useTelegram();
  const [raw, setRaw] = useState("50");

  const range = plans.data?.donate_custom_range;
  const parsed = Number(raw);
  const valid =
    !!range &&
    Number.isFinite(parsed) &&
    parsed >= range.min &&
    parsed <= range.max;

  const onSubmit = useCallback(async () => {
    if (!valid) return;
    try {
      const inv = await getInvoice("donate_custom", parsed);
      openInvoice(inv.invoice_link, status => {
        if (status === "paid") {
          haptic?.notificationOccurred?.("success");
          toast.success("Katta rahmat!");
        }
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || "Xato");
    }
  }, [valid, parsed, openInvoice, haptic]);

  useMainButton({
    text: valid ? `${parsed} ⭐ yuborish` : "Miqdorni kiriting",
    enabled: valid,
    onClick: onSubmit,
  });

  if (plans.isLoading) return <StatusView kind="loading" />;
  if (!plans.data || !range) return <StatusView kind="error" />;

  return (
    <List>
      <Section
        header="Boshqa miqdor"
        footer={`Diapazon: ${range.min}–${range.max} ⭐`}
      >
        <Input
          type="number"
          value={raw}
          min={range.min}
          max={range.max}
          onChange={e => setRaw(e.target.value)}
          placeholder="Miqdor"
        />
        <Cell subtitle="Yuboriladi">
          {valid ? <Money stars={parsed} /> : <Caption>—</Caption>}
        </Cell>
      </Section>
    </List>
  );
}
