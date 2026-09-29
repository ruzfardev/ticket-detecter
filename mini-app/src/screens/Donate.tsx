import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coffee, Cookie, Cake, Gift, Heart, Pencil } from "lucide-react";

import { getInvoice, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Money } from "@/components/Money";
import { Card } from "@/components/ui/card";
import { ListGroup, ListRow } from "@/components/ui/list";

const PLAN_ICONS: Record<string, typeof Coffee> = {
  donate_25:  Coffee,
  donate_50:  Cookie,
  donate_100: Cake,
  donate_500: Gift,
};

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
    <Screen padded>
      <Card variant="coral" pad="lg">
        <div className="flex flex-col gap-3">
          <Heart className="h-6 w-6 text-on-primary" strokeWidth={1.75} fill="currentColor" />
          <h1 className="font-display text-display-md tracking-tight text-on-primary">
            Loyihaga rahmat
          </h1>
          <p className="text-body-md text-on-primary/80">
            Premium bermaydi — faqat botni qo'llab-quvvatlash uchun.
          </p>
        </div>
      </Card>

      <ListGroup label="Tayyor variantlar">
        {plans.data.donate.map(d => {
          const Icon = PLAN_ICONS[d.id] ?? Gift;
          return (
            <ListRow
              key={d.id}
              before={<Icon className="h-5 w-5 text-ink" strokeWidth={1.75} />}
              title={d.label}
              after={<Money stars={d.stars} />}
              onClick={() => donate(d.id)}
            />
          );
        })}
      </ListGroup>

      <ListGroup>
        <ListRow
          before={<Pencil className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title="Boshqa miqdor"
          subtitle="O'zingiz xohlagan summa"
          chevron
          onClick={() => navigate("/donate/custom")}
        />
      </ListGroup>
    </Screen>
  );
}
