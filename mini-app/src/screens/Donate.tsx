import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banner, Button, Cell, Input, List, Modal, Section, Spinner,
} from "@telegram-apps/telegram-ui";
import { toast } from "sonner";

import { getInvoice, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";

export function Donate() {
  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const { openInvoice, haptic } = useTelegram();
  const [customOpen, setCustomOpen] = useState(false);
  const [amount, setAmount] = useState(50);

  const donate = async (planId: string, amt?: number) => {
    try {
      const inv = await getInvoice(planId, amt);
      openInvoice(inv.invoice_link, status => {
        if (status === "paid") {
          haptic?.notificationOccurred?.("success");
          toast.success("Katta rahmat! 🙏");
          setCustomOpen(false);
        }
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || "Xato");
    }
  };

  if (plans.isLoading) return <Spinner size="l" />;
  const range = plans.data?.donate_custom_range;

  return (
    <List>
      <Banner
        header="💝 Botni qo'llab-quvvatlash"
        subheader="Premium bermaydi — faqat loyihaga yordam. Rahmat 🙏"
        type="section"
      />

      <Section>
        {plans.data?.donate.map(d => (
          <Cell
            key={d.id}
            before={d.emoji}
            after={<b>⭐ {d.stars}</b>}
            onClick={() => donate(d.id)}
          >
            {d.label}
          </Cell>
        ))}
        <Cell before="✏️" onClick={() => setCustomOpen(true)}>
          Boshqa miqdor
        </Cell>
      </Section>

      <Modal open={customOpen} onOpenChange={setCustomOpen}>
        <div style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 12px" }}>Miqdorni tanlang</h3>
          <p style={{ margin: "0 0 12px", color: "var(--tg-theme-hint-color)" }}>
            Diapazon: {range?.min}–{range?.max} ⭐
          </p>
          <Input
            type="number"
            value={amount}
            min={range?.min}
            max={range?.max}
            onChange={e => setAmount(+e.target.value)}
          />
          <div style={{ marginTop: 16 }}>
            <Button stretched onClick={() => donate("donate_custom", amount)}>
              ⭐ {amount} bilan rahmat aytish
            </Button>
          </div>
        </div>
      </Modal>
    </List>
  );
}
