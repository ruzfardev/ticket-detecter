import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Banner, Cell, List, Section,
} from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import {
  Coffee, Cookie, Cake, Gift, Heart, Pencil, ChevronRight,
} from "lucide-react";

import { getInvoice, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { IconText, Money, StatusView } from "@/ui";

const PLAN_ICONS: Record<string, any> = {
  donate_25:  Coffee,
  donate_50:  Cookie,
  donate_100: Cake,
  donate_500: Gift,
};

function planIcon(id: string) {
  const Icon = PLAN_ICONS[id] ?? Gift;
  return <Icon size={22} strokeWidth={1.75} />;
}

export function Donate() {
  const navigate = useNavigate();
  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const { openInvoice, haptic } = useTelegram();

  const donate = async (planId: string) => {
    try {
      const inv = await getInvoice(planId);
      openInvoice(inv.invoice_link, status => {
        if (status === "paid") {
          haptic?.notificationOccurred?.("success");
          toast.success("Katta rahmat!");
        }
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || "Xato");
    }
  };

  if (plans.isLoading) return <StatusView kind="loading" />;
  if (!plans.data) return <StatusView kind="error" />;

  return (
    <List>
      <Banner
        header={<IconText icon={Heart} size={22}>Loyihaga rahmat</IconText>}
        subheader="Premium bermaydi — faqat botni qo'llab-quvvatlash."
        type="section"
      />

      <Section header="Tayyor variantlar">
        {plans.data.donate.map(d => (
          <Cell
            key={d.id}
            before={planIcon(d.id)}
            after={<Money stars={d.stars} />}
            onClick={() => donate(d.id)}
          >
            {d.label}
          </Cell>
        ))}
      </Section>

      <Section>
        <Cell
          before={<Pencil size={22} strokeWidth={1.75} />}
          after={<ChevronRight size={18} strokeWidth={1.75} />}
          onClick={() => navigate("/donate/custom")}
        >
          Boshqa miqdor
        </Cell>
      </Section>
    </List>
  );
}
