import { useQuery } from "@tanstack/react-query";
import {
  Banner, Caption, Cell, List, Section, Spinner,
} from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import {
  Check, Gauge, Layers, Zap, Sparkles, Gem,
} from "lucide-react";

import { getInvoice, getMe, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";

const benefitIcon = (Icon: any) => (
  <Icon size={20} strokeWidth={1.75} color="var(--tg-theme-button-color, #2481cc)" />
);

export function Premium() {
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const { openInvoice, haptic } = useTelegram();

  const buy = async (planId: string) => {
    try {
      const inv = await getInvoice(planId);
      openInvoice(inv.invoice_link, status => {
        if (status === "paid") {
          haptic?.notificationOccurred?.("success");
          toast.success("Premium aktivlashtirildi");
          me.refetch();
        } else if (status === "failed" || status === "cancelled") {
          toast.error("To'lov bekor qilindi");
        }
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || "Xato");
    }
  };

  if (me.isLoading || plans.isLoading) return <Spinner size="l" />;

  return (
    <List>
      <Banner
        header={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={22} strokeWidth={1.75} /> Premium
          </span>
        }
        subheader={
          me.data?.user.tier === "premium"
            ? `Aktiv. Tugashi: ${me.data.user.premium_until?.slice(0, 10)}`
            : "Hozirgi: Free"
        }
        type="section"
      />

      <Section header="Afzalliklari">
        <Cell before={benefitIcon(Gauge)}>Har 10 sekundda tekshirish (oddiy: 30s)</Cell>
        <Cell before={benefitIcon(Layers)}>3 ta aktiv xabarnoma (oddiy: 1)</Cell>
        <Cell before={benefitIcon(Zap)}>Yangi funksiyalarga dastlab kirish</Cell>
        <Cell before={benefitIcon(Check)}>3 baravar tezroq topish</Cell>
      </Section>

      <Section header="Tarif tanlang">
        {plans.data?.premium.map(p => (
          <Cell
            key={p.id}
            before={p.badge
              ? <Gem size={22} strokeWidth={1.75} color="var(--tg-theme-button-color)" />
              : undefined}
            after={
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{p.stars} ⭐</b>
                <Caption level="2">{(p.stars / p.days).toFixed(1)} ⭐/kun</Caption>
              </div>
            }
            subtitle={p.badge ? "Eng tejamli" : undefined}
            onClick={() => buy(p.id)}
          >
            {p.days} kun
          </Cell>
        ))}
      </Section>
    </List>
  );
}
