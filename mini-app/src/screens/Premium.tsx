import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Gauge, Layers, Zap, Sparkles } from "lucide-react";

import { getInvoice, getMe, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Money } from "@/components/Money";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatUntil(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return null;
  }
}

const BENEFITS = [
  { Icon: Gauge,  text: "Har 10 sekundda tekshirish (oddiy: 30s)" },
  { Icon: Layers, text: "3 ta aktiv xabarnoma (oddiy: 1)" },
  { Icon: Zap,    text: "Yangi funksiyalarga dastlab kirish" },
  { Icon: Check,  text: "Prioritet support" },
];

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
  const until = formatUntil(me.data.user.premium_until);

  return (
    <Screen tabbed padded>
      {/* Hero */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-coral" strokeWidth={1.75} />
          <Badge variant="coral">Premium</Badge>
        </div>
        <h1 className="font-display text-display-lg tracking-tight text-ink">
          Tezroq topish.<br />
          Kengroq imkoniyat.
        </h1>
        <p className="text-body-md text-body">
          {tier === "premium" && until
            ? `Sizning Premium ${until} gacha aktiv.`
            : "Free tarifida 1 ta xabarnoma, 30 sekund tekshirish. Premium 3× tezroq."}
        </p>
      </section>

      {/* Benefits */}
      <Card variant="feature" pad="lg">
        <ul className="space-y-3">
          {BENEFITS.map(({ Icon, text }, i) => (
            <li key={i} className="flex items-start gap-3">
              <Icon className="h-5 w-5 text-coral mt-0.5" strokeWidth={1.75} />
              <span className="text-body-md text-body-strong">{text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Plans */}
      <section className="space-y-3">
        <h2 className="font-display text-display-sm tracking-tight text-ink px-1">
          Tarif tanlang
        </h2>
        <div className="space-y-3">
          {plans.data.premium.map(p => {
            const featured = !!p.badge;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => buy(p.id)}
                className={cn(
                  "w-full text-left rounded-lg p-5 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30",
                  featured
                    ? "bg-surface-dark text-on-dark"
                    : "bg-canvas hairline hover:bg-surface-soft",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-display tracking-tight",
                          featured ? "text-display-sm text-on-dark" : "text-display-sm text-ink",
                        )}
                      >
                        {p.days} kun
                      </span>
                      {featured && <Badge variant="coral">Eng tejamli</Badge>}
                    </div>
                    <div
                      className={cn(
                        "text-body-sm",
                        featured ? "text-on-dark-soft" : "text-muted",
                      )}
                    >
                      {(p.stars / p.days).toFixed(1)} ⭐ / kun
                    </div>
                  </div>
                  <Money
                    stars={p.stars}
                    tint={featured ? "on-dark" : "amber"}
                    className={cn(
                      "text-display-sm font-display",
                      featured ? "text-on-dark" : "text-ink",
                    )}
                  />
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-body-sm text-muted px-1 pt-1">
          To'lov Telegram Stars orqali. Istalgan paytda bekor qilish mumkin.
        </p>
      </section>
    </Screen>
  );
}
