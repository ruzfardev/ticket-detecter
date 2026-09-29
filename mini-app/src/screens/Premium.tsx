import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Gauge, Layers, Zap, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getInvoice, getMe, getPlans, type PlansResponse } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Money } from "@/components/Money";
import { Specular } from "@/components/glass/Specular";
import { Badge } from "@/components/ui/badge";
import { ListGroup, ListRow } from "@/components/ui/list";
import { PressCard } from "@/components/ui/press-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { IconTile, type TileTone } from "@/components/ui/tile";
import { cn } from "@/lib/utils";

function formatUntil(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return null;
  }
}

/** The benefit, then (muted) what Free gets instead. Read together they are
 *  the same sentence as ever — the split is only emphasis. */
const BENEFITS: { Icon: LucideIcon; tone: TileTone; text: string; note?: string }[] = [
  { Icon: Gauge,  tone: "coral", text: "Har 10 sekundda tekshirish", note: "(oddiy: 30s)" },
  { Icon: Layers, tone: "teal",  text: "3 ta aktiv xabarnoma",       note: "(oddiy: 1)" },
  { Icon: Zap,    tone: "amber", text: "Yangi funksiyalarga dastlab kirish" },
  { Icon: Check,  tone: "green", text: "Prioritet support" },
];

type Plan = PlansResponse["premium"][number];

/* The featured plan: night glass with dawn rising along its lower edge —
   coral under the price, amber further along — and a sheen on the top rim. */
const DAWN = [
  "radial-gradient(72% 92% at 84% 114%, hsl(var(--coral-bright) / 0.95), transparent 70%)",
  "radial-gradient(56% 80% at 14% 120%, hsl(var(--amber-bright) / 0.38), transparent 70%)",
  "linear-gradient(180deg, rgb(255 255 255 / 0.08), transparent 44%)",
].join(", ");

/**
 * One plan — the whole card is the tap target. The featured plan (the one the
 * server badges) is the standout: a dark pane lit from below, dark on the cream
 * canvas and glowing on the night one.
 *
 * Note: `cn` (tailwind-merge) reads the custom type sizes (`text-display-sm`…)
 * as colours and drops them next to a text colour, so size and colour classes
 * are joined plainly here, never merged.
 */
function PlanCard({ plan: p, pending, onBuy }: { plan: Plan; pending: boolean; onBuy: () => void }) {
  const featured = !!p.badge;
  return (
    <PressCard
      material={featured ? "none" : "surface"}
      onClick={onBuy}
      aria-busy={pending || undefined}
      style={featured ? { backgroundImage: DAWN } : undefined}
      className={cn(
        "relative overflow-hidden rounded-[26px] px-5 py-4",
        featured &&
          "bg-surface-dark shadow-[0_18px_34px_-16px_hsl(var(--coral-bright)/0.75),0_2px_8px_hsl(var(--shadow)/0.2),inset_0_1px_0_rgb(255_255_255/0.12),inset_0_0_0_1px_hsl(var(--coral-bright)/0.42)]",
      )}
    >
      <div className={`flex items-center gap-4 ${featured ? "text-on-dark" : "text-ink"}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="tnum text-display-sm">{p.days} kun</span>
            {featured && <Badge variant="solid">Eng tejamli</Badge>}
          </div>
          <div className={`tnum mt-0.5 text-body-sm ${featured ? "text-on-dark-soft" : "text-muted"}`}>
            {(p.stars / p.days).toFixed(1)} ⭐ / kun
          </div>
        </div>
        <span className="relative shrink-0">
          <Money
            stars={p.stars}
            tint={featured ? "on-dark" : "amber"}
            className={cn("text-display-sm font-semibold", pending && "invisible")}
          />
          {pending && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner size="sm" className={featured ? "text-on-dark" : undefined} />
            </span>
          )}
        </span>
      </div>
    </PressCard>
  );
}

/** Mirrors the page (hero, benefits, five plans) so nothing jumps on load. */
function PremiumSkeleton() {
  return (
    <Screen tabbed padded nav navTitle="Premium" reveal={false}>
      <Skeleton className="h-[250px] rounded-[30px]" />
      <div className="space-y-px overflow-hidden rounded-[26px]">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[54px] rounded-none" />)}
      </div>
      <div className="space-y-3">
        <Skeleton className="mx-1 h-5 w-32 rounded-full" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-[79px] rounded-[26px]" />)}
      </div>
    </Screen>
  );
}

export function Premium() {
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const { openInvoice, haptic } = useTelegram();
  // The plan whose invoice link is being fetched — its card shows a spinner.
  const [pending, setPending] = useState<string | null>(null);

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

  const onBuy = (planId: string) => {
    setPending(planId);
    buy(planId).finally(() => setPending(cur => (cur === planId ? null : cur)));
  };

  if (me.isLoading || plans.isLoading) return <PremiumSkeleton />;
  if (!me.data || !plans.data) {
    return <StatusView kind="error" description="Ma'lumotni yuklab bo'lmadi." />;
  }

  const tier = me.data.user.tier;
  const until = formatUntil(me.data.user.premium_until);

  return (
    <Screen tabbed padded nav navTitle="Premium">
      {/* Hero — the one glass pane on the page, lit like dawn through a window. */}
      <section className="glass relative overflow-hidden rounded-[30px] p-5 pb-6">
        <Specular />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-[radial-gradient(closest-side,hsl(var(--coral-bright)/0.4),transparent)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-20 size-64 rounded-full bg-[radial-gradient(closest-side,hsl(var(--amber-bright)/0.26),transparent)]"
        />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-[16px] shadow-[0_10px_24px_-8px_hsl(var(--amber-bright)/0.85)]">
              <IconTile icon={Sparkles} tone="amber" size={52} />
            </span>
            <Badge variant="solid">Premium</Badge>
          </div>
          {/* One line per sentence: below 375 pt "Kengroq imkoniyat." no
              longer fits at 34 pt, so it steps down to 28 like a long title. */}
          <h1 className="mt-5 font-display text-display-xl text-ink max-[374px]:text-display-lg">
            Tezroq topish.<br />
            <span className="text-coral-ink">Kengroq imkoniyat.</span>
          </h1>
          <p className="mt-2 text-body-md text-body [text-wrap:pretty]">
            {tier === "premium" && until
              ? `Sizning Premium ${until} gacha aktiv.`
              : "Free tarifida 1 ta xabarnoma, 30 sekund tekshirish. Premium 3× tezroq."}
          </p>
        </div>
      </section>

      {/* Benefits */}
      <ListGroup>
        {BENEFITS.map(({ Icon, tone, text, note }) => (
          <ListRow
            key={text}
            before={<IconTile icon={Icon} tone={tone} />}
            title={
              <span className="block whitespace-normal [text-wrap:pretty]">
                {text}
                {note && <span className="text-muted"> {note}</span>}
              </span>
            }
          />
        ))}
      </ListGroup>

      {/* Plans */}
      <section className="space-y-3">
        <h2 className="px-1 font-display text-display-sm text-ink">Tarif tanlang</h2>
        <div className="space-y-3">
          {plans.data.premium.map(p => (
            <PlanCard key={p.id} plan={p} pending={pending === p.id} onBuy={() => onBuy(p.id)} />
          ))}
        </div>
        <p className="px-1 pt-1 text-caption text-muted">
          To'lov Telegram Stars orqali. Istalgan paytda bekor qilish mumkin.
        </p>
      </section>
    </Screen>
  );
}
