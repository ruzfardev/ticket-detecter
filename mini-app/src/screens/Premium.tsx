import { useQuery } from "@tanstack/react-query";
import {
  Banner, Caption, Cell, List, Section,
} from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import {
  Check, Gauge, Layers, Zap, Sparkles, Gem,
} from "lucide-react";

import { getInvoice, getMe, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { IconText, Money, Stack, StatusView } from "@/ui";

function benefitIcon(Icon: any) {
  return <Icon size={20} strokeWidth={1.75} color="var(--tg-accent)" />;
}

function formatPremiumUntil(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return null;
  }
}

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

  if (me.isLoading || plans.isLoading) return <StatusView kind="loading" />;
  if (!me.data || !plans.data) return <StatusView kind="error" />;

  const tier = me.data.user.tier;
  const until = formatPremiumUntil(me.data.user.premium_until);

  return (
    <List>
      <Banner
        header={<IconText icon={Sparkles} size={22}>Premium</IconText>}
        subheader={
          tier === "premium" && until
            ? `Aktiv · ${until} gacha`
            : "Hozirgi: Free tarifi"
        }
        type="section"
      />

      <Section header="Afzalliklari">
        <Cell before={benefitIcon(Gauge)}>3× tezroq tekshirish (10s vs 30s)</Cell>
        <Cell before={benefitIcon(Layers)}>3 ta aktiv xabarnoma</Cell>
        <Cell before={benefitIcon(Zap)}>Yangi funksiyalarga dastlab kirish</Cell>
        <Cell before={benefitIcon(Check)}>Prioritet support</Cell>
      </Section>

      <Section header="Tarif tanlang" footer="To'lov Telegram Stars orqali. Istalgan paytda bekor qilish mumkin.">
        {plans.data.premium.map(p => (
          <Cell
            key={p.id}
            before={
              p.badge
                ? <Gem size={22} strokeWidth={1.75} color="var(--tg-accent)" />
                : undefined
            }
            after={
              <Stack direction="column" gap={1} align="flex-end">
                <Money stars={p.stars} />
                <Caption level="2">{(p.stars / p.days).toFixed(1)} ⭐/kun</Caption>
              </Stack>
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
