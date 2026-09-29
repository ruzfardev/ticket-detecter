import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import * as m from "motion/react-m";
import { Coffee, Cookie, Cake, Gift, Heart, Pencil } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getInvoice, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { spring } from "@/lib/motion";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Money } from "@/components/Money";
import { Specular } from "@/components/glass/Specular";
import { Card } from "@/components/ui/card";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { IconTile, type TileTone } from "@/components/ui/tile";

const PLAN_ICONS: Record<string, { Icon: LucideIcon; tone: TileTone }> = {
  donate_25:  { Icon: Coffee, tone: "amber"  },
  donate_50:  { Icon: Cookie, tone: "coral"  },
  donate_100: { Icon: Cake,   tone: "pink"   },
  donate_500: { Icon: Gift,   tone: "violet" },
};

/** The hero and a list of four, as placeholders. */
function DonateSkeleton() {
  return (
    <Screen padded nav navTitle="Loyihaga rahmat" reveal={false}>
      <Skeleton className="h-[196px] rounded-[30px]" />
      <div className="space-y-2">
        <Skeleton className="mx-5 h-3.5 w-32 rounded-full" />
        <div className="space-y-px overflow-hidden rounded-[26px]">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[52px] rounded-none" />)}
        </div>
      </div>
    </Screen>
  );
}

export function Donate() {
  const navigate = useNavigate();
  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const { openInvoice, haptic } = useTelegram();
  // The option whose invoice link is being fetched — its row shows a spinner.
  const [pending, setPending] = useState<string | null>(null);

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

  const onDonate = (planId: string) => {
    setPending(planId);
    donate(planId).finally(() => setPending(cur => (cur === planId ? null : cur)));
  };

  if (plans.isLoading) return <DonateSkeleton />;
  if (!plans.data) {
    return <StatusView kind="error" description="Ma'lumotni yuklab bo'lmadi." />;
  }

  return (
    <Screen padded nav navTitle="Loyihaga rahmat">
      {/* The screen's one luminous pane: a thank-you, not a sale. */}
      <Card variant="coral" pad="lg" className="relative overflow-hidden rounded-[30px]">
        <Specular />
        <div className="relative flex flex-col items-start gap-4">
          <m.span
            aria-hidden
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ ...spring.bouncy, delay: 0.18 }}
            className="flex size-12 items-center justify-center rounded-full bg-on-primary/20 shadow-[inset_0_1px_0.5px_rgb(255_255_255/0.55),inset_0_0_0_0.5px_rgb(255_255_255/0.3)]"
          >
            <Heart className="size-6 text-on-primary" strokeWidth={1.75} fill="currentColor" />
          </m.span>
          <div className="space-y-1.5">
            <h1 className="font-display text-display-lg text-on-primary">Loyihaga rahmat</h1>
            <p className="text-body-md text-on-primary/85">
              Premium bermaydi — faqat botni qo'llab-quvvatlash uchun.
            </p>
          </div>
        </div>
      </Card>

      <ListGroup label="Tayyor variantlar">
        {plans.data.donate.map(d => {
          const { Icon, tone } = PLAN_ICONS[d.id] ?? { Icon: Gift, tone: "violet" as const };
          const busy = pending === d.id;
          return (
            <ListRow
              key={d.id}
              aria-busy={busy || undefined}
              before={<IconTile icon={Icon} tone={tone} />}
              title={d.label}
              after={
                <span className="relative">
                  <Money stars={d.stars} className={busy ? "invisible" : undefined} />
                  {busy && (
                    <span className="absolute inset-0 flex items-center justify-end">
                      <Spinner size="sm" />
                    </span>
                  )}
                </span>
              }
              onClick={() => onDonate(d.id)}
            />
          );
        })}
      </ListGroup>

      <ListGroup>
        <ListRow
          before={<IconTile icon={Pencil} tone="gray" />}
          title="Boshqa miqdor"
          subtitle="O'zingiz xohlagan summa"
          chevron
          onClick={() => navigate("/donate/custom")}
        />
      </ListGroup>
    </Screen>
  );
}
